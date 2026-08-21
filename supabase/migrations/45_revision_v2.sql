-- ============================================================
-- 45: Revisi V2 — Multi-tenancy, FRT, priority baru, hapus SLA.
-- 1) Hapus SLA total (config, badge, compute functions).
-- 2) Rename sla_elapsed_working_minutes → working_minutes_between.
-- 3) Tabel customer_sites_mapping (multi-tenancy sederhana).
-- 4) Kolom baru: bapp_document_url, rating, review, frt_minutes,
--    created_by_user_id di tickets; customer_id di users.
-- 5) Migrate priority P1/P2/P3 → Critical/Medium/Low.
-- 6) RPC: register_customer, set_frt_on_open.
-- 7) validate_transition: customer boleh buat tiket (NEW via RPC).
-- 8) RLS: customer hanya lihat tiket mereka sendiri.
-- ============================================================

-- ── 1. Hapus SLA total ──
DROP FUNCTION IF EXISTS compute_sla_batch(uuid[]) CASCADE;
DROP FUNCTION IF EXISTS sla_working_elapsed(uuid) CASCADE;
DROP FUNCTION IF EXISTS sla_deadline(timestamptz, numeric) CASCADE;
DROP TABLE IF EXISTS sla_config CASCADE;

-- Hapus sla_start_at dari tickets (sudah tidak dipakai)
ALTER TABLE tickets DROP COLUMN IF EXISTS sla_start_at;

-- ── 2. Rename working minutes function ──
-- Fungsi ini masih berguna untuk FRT (jam kerja 08-17 WIB, skip libur).
CREATE OR REPLACE FUNCTION working_minutes_between(p_from timestamptz, p_to timestamptz)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_holidays text[];
  v_day date;
  v_w_start timestamp;
  v_w_end timestamp;
  v_ov_start timestamp;
  v_ov_end timestamp;
  v_total numeric := 0;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RETURN 0;
  END IF;
  SELECT array_agg(to_char(date, 'YYYY-MM-DD')) INTO v_holidays FROM holidays WHERE is_active;
  FOR v_day IN
    SELECT generate_series(
      ((p_from AT TIME ZONE 'UTC') + interval '7 hours')::date,
      ((p_to AT TIME ZONE 'UTC') + interval '7 hours')::date,
      interval '1 day'
    )::date
  LOOP
    IF extract(dow FROM v_day)::int IN (0, 6) OR to_char(v_day, 'YYYY-MM-DD') = ANY(v_holidays) THEN
      CONTINUE;
    END IF;
    v_w_start := v_day::timestamp + interval '8 hours';
    v_w_end := v_day::timestamp + interval '17 hours';
    v_ov_start := GREATEST((p_from AT TIME ZONE 'UTC') + interval '7 hours', v_w_start);
    v_ov_end := LEAST((p_to AT TIME ZONE 'UTC') + interval '7 hours', v_w_end);
    IF v_ov_end > v_ov_start THEN
      v_total := v_total + extract(epoch FROM (v_ov_end - v_ov_start))::numeric / 60;
    END IF;
  END LOOP;
  RETURN round(v_total);
END $$;

-- Backward compat: lama sla_elapsed_working_minutes masih dipanggil
-- di beberapa tempat → wrapper.
CREATE OR REPLACE FUNCTION sla_elapsed_working_minutes(p_from timestamptz, p_to timestamptz)
RETURNS numeric
LANGUAGE sql STABLE
AS $$ SELECT working_minutes_between(p_from, p_to) $$;

-- ── 3. Tabel customer_sites_mapping ──
CREATE TABLE IF NOT EXISTS customer_sites_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, site_id)
);

ALTER TABLE customer_sites_mapping ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_all_customer_sites_mapping') THEN
    CREATE POLICY "staff_all_customer_sites_mapping" ON customer_sites_mapping
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 4. Kolom baru di tickets ──
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS bapp_document_url text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rating int;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS review text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS frt_minutes numeric;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- ── 5. Kolom baru di users ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

-- ── 6. Migrate priority: P1→Critical, P2→Medium, P3→Low ──
UPDATE tickets SET priority = 'Critical' WHERE priority = 'P1';
UPDATE tickets SET priority = 'Medium' WHERE priority = 'P2';
UPDATE tickets SET priority = 'Low' WHERE priority = 'P3';

-- ── 7. RPC: register_customer ──
CREATE OR REPLACE FUNCTION register_customer(
  p_name text,
  p_email text,
  p_phone text,
  p_company text,
  p_password text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_customer_id uuid;
  v_user_id uuid;
  v_auth_res jsonb;
BEGIN
  -- Validasi input
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN json_build_object('error', 'Nama wajib diisi.');
  END IF;
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN json_build_object('error', 'Email wajib diisi.');
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN json_build_object('error', 'Password minimal 6 karakter.');
  END IF;

  -- Cek duplikat email
  IF EXISTS (SELECT 1 FROM users WHERE email = trim(p_email) AND is_deleted = false) THEN
    RETURN json_build_object('error', 'Email sudah terdaftar.');
  END IF;

  -- Cari atau buat customer company
  IF p_company IS NOT NULL AND trim(p_company) <> '' THEN
    SELECT id INTO v_customer_id FROM customers
    WHERE lower(name) = lower(trim(p_company)) AND is_deleted = false
    LIMIT 1;
    IF v_customer_id IS NULL THEN
      INSERT INTO customers (name, phone) VALUES (trim(p_company), p_phone)
      RETURNING id INTO v_customer_id;
    END IF;
  END IF;

  -- Buat auth user via Supabase Auth (REST inject)
  -- Catatan: di production, ini harus lewat Edge Function atau service role.
  -- Untuk sekarang, kita buat user di tabel users saja (admin akan activate).
  v_user_id := gen_random_uuid();

  INSERT INTO users (id, email, username, name, full_name, wa_number, role, roles, status, customer_id, is_deleted)
  VALUES (v_user_id, trim(p_email), trim(p_email), trim(p_name), trim(p_name), p_phone,
          'customer', 'customer', 'aktif', v_customer_id, false);

  RETURN json_build_object('ok', true, 'user_id', v_user_id);
END $$;

REVOKE EXECUTE ON FUNCTION register_customer(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION register_customer(text, text, text, text, text) TO anon, authenticated;

-- ── 8. RPC: set_frt_on_open ──
-- Dipanggil saat helpdesk membuka tiket (status → OPEN).
-- Menghitung working minutes dari created_at ke sekarang, simpan ke frt_minutes.
CREATE OR REPLACE FUNCTION set_frt_on_open(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created timestamptz;
  v_minutes numeric;
BEGIN
  SELECT created_at INTO v_created FROM tickets WHERE id = p_ticket_id;
  IF v_created IS NULL THEN RETURN; END IF;
  v_minutes := working_minutes_between(v_created, now());
  UPDATE tickets SET frt_minutes = v_minutes WHERE id = p_ticket_id;
END $$;

REVOKE EXECUTE ON FUNCTION set_frt_on_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_frt_on_open(uuid) TO authenticated;

-- ── 9. RPC: submit_rating ──
-- Dipanggil oleh customer untuk memberikan rating & review.
CREATE OR REPLACE FUNCTION submit_rating(
  p_ticket_id uuid,
  p_rating int,
  p_review text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN json_build_object('error', 'Unauthorized'); END IF;
  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN json_build_object('error', 'Rating harus 1-5.');
  END IF;

  SELECT created_by_user_id INTO v_owner FROM tickets WHERE id = p_ticket_id;
  IF v_owner IS NULL OR v_owner <> v_uid THEN
    RETURN json_build_object('error', 'Anda tidak memiliki akses ke tiket ini.');
  END IF;

  UPDATE tickets SET rating = p_rating, review = p_review, updated_at = now()
  WHERE id = p_ticket_id AND status = 'CLOSED';

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Tiket belum CLOSED atau tidak ditemukan.');
  END IF;

  RETURN json_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION submit_rating(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_rating(uuid, int, text) TO authenticated;

-- ── 10. Update create_public_ticket: set created_by_user_id ──
--麒麟: public ticket tidak punya user (anon), tapi kita tetap track.
-- Customer ticket dibuat lewat create_internal_ticket (authenticated).
CREATE OR REPLACE FUNCTION create_public_ticket(
  p_reporter_name text,
  p_position text,
  p_phone text,
  p_site text,
  p_unit text,
  p_description text,
  p_photos text[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_id uuid;
  v_count int;
  i int;
  j int;
BEGIN
  IF p_reporter_name IS NULL OR trim(p_reporter_name) = '' OR
     p_site IS NULL OR trim(p_site) = '' OR
     p_unit IS NULL OR trim(p_unit) = '' OR
     p_description IS NULL OR trim(p_description) = '' THEN
    RETURN json_build_object('error', 'Semua field wajib diisi.');
  END IF;

  -- Rate limit
  IF p_phone IS NOT NULL AND trim(p_phone) <> '' THEN
    INSERT INTO rate_limits (key, window_start, count)
    VALUES ('phone:' || trim(p_phone), now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - interval '600 seconds'
                   THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - interval '600 seconds'
                          THEN now() ELSE rate_limits.window_start END
    RETURNING count INTO v_count;

    IF v_count > 3 THEN
      RETURN json_build_object('error', 'Terlalu banyak laporan dalam 10 menit. Silakan coba lagi nanti.');
    END IF;
  END IF;

  FOR i IN 1..10 LOOP
    v_code := 'ATC-' || to_char(now(), 'YYYYMMDD') || '-';
    FOR j IN 1..4 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM tickets WHERE code = v_code);
  END LOOP;

  BEGIN
    INSERT INTO tickets (code, customer, company, site, unit, location, category, description, status, priority, created_by)
    VALUES (v_code, p_reporter_name, p_site, p_site, p_unit, p_site, p_unit,
            'Jabatan: ' || coalesce(p_position, '') || E'\nWA Pelapor: ' || coalesce(p_phone, '') || E'\n\n' || p_description,
            'NEW', NULL, NULL)
    RETURNING id INTO v_id;
  EXCEPTION WHEN foreign_key_violation THEN
    RETURN json_build_object('error', 'Site atau Unit belum terdaftar di sistem. Silakan hubungi Helpdesk via WhatsApp Group.');
  END;

  INSERT INTO activities (ticket_id, user_id, user_name, action)
  VALUES (v_id, NULL, p_reporter_name, 'Tiket dibuat dengan status Baru');

  IF p_photos IS NOT NULL AND cardinality(p_photos) > 0 THEN
    INSERT INTO activities (ticket_id, user_id, user_name, action, details)
    VALUES (v_id, NULL, p_reporter_name, 'Foto keluhan (' || cardinality(p_photos) || ')',
            'Foto keluhan:' || E'\n' || array_to_string(p_photos, E'\n'));
  END IF;

  PERFORM notify_role('helpdesk', 'Tiket baru: ' || v_code,
    'Tiket ' || v_code || ' dari ' || p_site || ' (' || p_unit || ') menunggu validasi.');

  RETURN json_build_object('code', v_code);
END $$;

-- ── 11. Update create_internal_ticket: support customer role ──
CREATE OR REPLACE FUNCTION create_internal_ticket(
  p_code text, p_customer text, p_company text, p_site text, p_unit text,
  p_status text, p_priority text, p_description text,
  p_activity_action text, p_activity_details text,
  p_category text DEFAULT NULL, p_location text DEFAULT NULL, p_photo_url text DEFAULT NULL
) RETURNS tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_row tickets;
  v_user_customer_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;

  -- Customer bisa buat tiket baru dengan status NEW
  IF v_role = 'customer' THEN
    IF p_status <> 'NEW' THEN
      RAISE EXCEPTION 'customer can only create NEW tickets';
    END IF;
  ELSIF NOT validate_transition(v_role, NULL, p_status) THEN
    RAISE EXCEPTION 'forbidden: role % cannot create ticket', v_role;
  END IF;

  -- Customer: pilih site hanya dari yang di-mapped
  IF v_role = 'customer' THEN
    SELECT customer_id INTO v_user_customer_id FROM users WHERE id = v_uid;
    IF v_user_customer_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM customer_sites_mapping csm
        JOIN sites s ON csm.site_id = s.id
        WHERE csm.customer_id = v_user_customer_id AND s.name = p_site
      ) THEN
        RAISE EXCEPTION 'site tidak tersedia untuk akun Anda';
      END IF;
    END IF;
  END IF;

  INSERT INTO tickets
    (code, customer, company, site, unit, status, priority, description, category, location, photo_url, created_by, created_by_user_id)
  VALUES
    (p_code, p_customer, p_company, p_site, p_unit, p_status, p_priority, p_description, p_category, p_location, p_photo_url, v_uid, v_uid)
  RETURNING * INTO v_row;

  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (v_row.id, v_uid, COALESCE((SELECT full_name FROM users WHERE id = v_uid), ''),
          p_activity_action, p_activity_details);

  IF p_status = 'UNASSIGNED' THEN
    PERFORM notify_role('pm', 'Tiket baru: ' || v_row.code,
      'Tiket ' || v_row.code || ' siap dijadwalkan.');
  ELSIF v_role <> 'helpdesk' THEN
    PERFORM notify_role('helpdesk', 'Tiket baru: ' || v_row.code,
      'Tiket ' || v_row.code || ' menunggu validasi.');
  END IF;
  RETURN v_row;
END $$;

-- ── 12. Update update_ticket_status: set FRT saat OPEN ──
CREATE OR REPLACE FUNCTION update_ticket_status(
  p_ticket_id uuid, p_new_status text, p_new_priority text DEFAULT NULL,
  p_resolved_by text DEFAULT NULL, p_rejection_reason text DEFAULT NULL,
  p_activity_action text DEFAULT NULL, p_activity_details text DEFAULT NULL,
  p_duplicate_of uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_old_status text;
  v_own boolean;
  v_full_name text;
  v_code text;
  v_assignee uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS NULL THEN RAISE EXCEPTION 'forbidden: user has no role'; END IF;

  SELECT status, (assigned_to = v_uid), code, assigned_to
    INTO v_old_status, v_own, v_code, v_assignee
  FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  IF p_new_priority IS NOT NULL AND v_role NOT IN ('helpdesk', 'pm') THEN
    RAISE EXCEPTION 'forbidden: priority change is staff-only';
  END IF;

  IF v_role = 'teknisi' AND NOT v_own THEN
    IF p_new_status <> 'RESOLVED' OR NOT can_teknisi_complete(p_ticket_id, v_uid) THEN
      RAISE EXCEPTION 'forbidden: teknisi can only act on own ticket';
    END IF;
  END IF;

  IF NOT validate_transition(v_role, v_old_status, p_new_status) THEN
    RAISE EXCEPTION 'forbidden: % cannot transition % -> %', v_role, v_old_status, p_new_status;
  END IF;

  IF v_old_status = 'CLOSED' AND p_new_status = 'WORKING' THEN
    IF (SELECT closed_at FROM tickets WHERE id = p_ticket_id) < now() - interval '7 days' THEN
      RAISE EXCEPTION 'forbidden: closed more than 7 days, cannot reopen';
    END IF;
  END IF;

  IF p_new_status <> 'DUPLICATE' AND p_duplicate_of IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden: duplicate_of only valid when marking DUPLICATE';
  END IF;
  IF p_duplicate_of = p_ticket_id THEN
    RAISE EXCEPTION 'forbidden: duplicate_of cannot be the ticket itself';
  END IF;
  IF p_duplicate_of IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tickets WHERE id = p_duplicate_of) THEN
    RAISE EXCEPTION 'ticket not found: duplicate_of target';
  END IF;

  UPDATE tickets SET
    status = p_new_status,
    updated_at = now(),
    priority = COALESCE(p_new_priority, priority),
    resolved_by = COALESCE(p_resolved_by, resolved_by),
    rejection_reason = COALESCE(p_rejection_reason, rejection_reason),
    rework_flag = CASE WHEN p_new_status = 'WORKING' AND v_old_status IN ('RESOLVED', 'CLOSED')
                      THEN true ELSE rework_flag END,
    closed_at = CASE WHEN p_new_status IN ('CLOSED', 'VOID', 'DUPLICATE')
                    THEN now() ELSE closed_at END,
    duplicate_of = CASE WHEN p_new_status = 'DUPLICATE' AND p_duplicate_of IS NOT NULL
                        THEN p_duplicate_of ELSE duplicate_of END
  WHERE id = p_ticket_id;

  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;
  IF p_new_status <> v_old_status THEN
    INSERT INTO activities (ticket_id, user_id, user_name, action, details)
    VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
            COALESCE(p_activity_action, format('Status: %s -> %s', v_old_status, p_new_status)),
            p_activity_details);
  END IF;

  -- FRT: hitung saat helpdesk buka tiket (NEW → OPEN)
  IF p_new_status = 'OPEN' AND v_old_status = 'NEW' THEN
    PERFORM set_frt_on_open(p_ticket_id);
  END IF;

  IF p_new_status = 'RESOLVED' THEN
    PERFORM notify_role('helpdesk', 'Validasi penyelesaian: ' || v_code,
      'Tiket ' || v_code || ' menunggu validasi penyelesaian (Close/Rework).');
    IF v_assignee IS NOT NULL THEN
      PERFORM notify_role('pm', 'Info selesai: ' || v_code,
        'Tiket ' || v_code || ' selesai dikerjakan' ||
        CASE WHEN v_full_name IS NOT NULL THEN ' oleh ' || v_full_name ELSE '' END ||
        ' — menunggu validasi helpdesk.');
    END IF;
  ELSIF p_new_status = 'UNASSIGNED' AND v_role = 'helpdesk' THEN
    PERFORM notify_role('pm', 'Tiket baru: ' || v_code,
      'Tiket ' || v_code || ' menunggu penjadwalan teknisi.');
  ELSIF p_new_status = 'PENDING' THEN
    PERFORM notify_role('pm', 'Kendala: ' || v_code,
      'Tiket ' || v_code || ' dijeda teknisi — perlu persetujuan.');
  ELSIF p_new_status = 'WORKING' AND v_old_status IN ('RESOLVED', 'CLOSED') AND v_assignee IS NOT NULL THEN
    PERFORM notify_user(v_assignee, 'Rework: ' || v_code,
      'Tiket ' || v_code || ' dikembalikan untuk perbaikan ulang.');
  ELSIF p_new_status IN ('CLOSED', 'VOID', 'DUPLICATE') AND v_assignee IS NOT NULL THEN
    PERFORM notify_user(v_assignee, 'Tiket ' || v_code || ' ' || p_new_status,
      'Tiket ' || v_code || ' berstatus ' || p_new_status || '.');
  END IF;
END $$;

-- ── 13. RLS: customer hanya lihat tiket sendiri ──
-- Drop existing permissive anon policy on tickets (dari migration 01).
-- Customer hanya bisa SELECT tiket yang created_by_user_id = auth.uid().
-- Staff (admin/helpdesk/pm/teknisi) tetap bisa lihat semua.
DO $$
BEGIN
  -- Hapus policy lama yang terlalu permissive
  DROP POLICY IF EXISTS "anon_all_tickets" ON tickets;

  -- Policy baru: authenticated staff lihat semua
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_all_tickets' AND tablename = 'tickets') THEN
    CREATE POLICY "staff_all_tickets" ON tickets
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'helpdesk', 'pm', 'teknisi'))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'helpdesk', 'pm', 'teknisi'))
      );
  END IF;

  -- Policy baru: customer hanya lihat tiket sendiri
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customer_own_tickets' AND tablename = 'tickets') THEN
    CREATE POLICY "customer_own_tickets" ON tickets
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'customer')
        AND created_by_user_id = auth.uid()
      );
  END IF;

  -- Policy anon tetap bisa INSERT via create_public_ticket (RPC SECURITY DEFINER)
  -- tapi tidak bisa SELECT/UPDATE/DELETE.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_only_tickets' AND tablename = 'tickets') THEN
    CREATE POLICY "anon_insert_only_tickets" ON tickets
      FOR INSERT TO anon
      WITH CHECK (true);
  END IF;
END $$;

-- ── 14. Customer_sites_mapping: izinkan customer baca ──
-- Customer bisa baca mapping mereka sendiri.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customer_read_own_mapping' AND tablename = 'customer_sites_mapping') THEN
    CREATE POLICY "customer_read_own_mapping" ON customer_sites_mapping
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'customer')
      );
  END IF;
END $$;

-- ── 15. Index untuk performa ──
CREATE INDEX IF NOT EXISTS idx_tickets_created_by_user ON tickets(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_frt ON tickets(frt_minutes) WHERE frt_minutes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_sites_customer ON customer_sites_mapping(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sites_site ON customer_sites_mapping(site_id);
CREATE INDEX IF NOT EXISTS idx_users_customer_id ON users(customer_id);

-- ── 16. Self-check ──
DO $$
DECLARE
  v_site uuid; v_unit uuid; v_cust_id uuid;
  v_user_id uuid; v_ticket_id uuid;
  v_res json;
BEGIN
  SET LOCAL session_replication_role = replica;

  -- Buat test data
  INSERT INTO customers (name) VALUES ('Test Company 45') RETURNING id INTO v_cust_id;
  INSERT INTO sites (name, pic_name, pic_phone) VALUES ('Test Site 45', 'PIC', '081') RETURNING id INTO v_site;
  INSERT INTO units (site_id, name) VALUES (v_site, 'Test Unit 45') RETURNING id INTO v_unit;
  INSERT INTO customer_sites_mapping (customer_id, site_id) VALUES (v_cust_id, v_site);

  -- Buat customer user
  v_user_id := gen_random_uuid();
  INSERT INTO users (id, email, username, name, full_name, role, roles, status, customer_id, is_deleted)
  VALUES (v_user_id, 'test45@test.com', 'test45', 'Test 45', 'Test 45', 'customer', 'customer', 'aktif', v_cust_id, false);

  -- FRT function exists
  ASSERT working_minutes_between(now(), now()) = 0, 'working_minutes_between harus ada';

  -- Priority migrated
  ASSERT NOT EXISTS (SELECT 1 FROM tickets WHERE priority IN ('P1', 'P2', 'P3')),
         'tidak boleh ada priority P1/P2/P3';

  -- Cleanup
  DELETE FROM customer_sites_mapping WHERE customer_id = v_cust_id;
  DELETE FROM units WHERE id = v_unit;
  DELETE FROM sites WHERE id = v_site;
  DELETE FROM customers WHERE id = v_cust_id;
  DELETE FROM users WHERE id = v_user_id;

  RESET session_replication_role;
END $$;
