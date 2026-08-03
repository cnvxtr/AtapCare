-- ============================================================
-- ATAP CARE — Hardening RLS (Fase 1)
-- Policy berbasis role via subquery public.users.role (tanpa infra
-- custom_access_token_hook). Portal publik tidak lagi menyentuh tabel
-- langsung; lewat RPC SECURITY DEFINER.
-- Jalankan setelah 01_admin.sql & 02_notifications.sql.
-- ============================================================

-- ── 0. Drop policy permissive lama ──
DROP POLICY IF EXISTS "anon_all_customers" ON customers;
DROP POLICY IF EXISTS "anon_all_regions" ON regions;
DROP POLICY IF EXISTS "anon_all_sites" ON sites;
DROP POLICY IF EXISTS "anon_all_units" ON units;
DROP POLICY IF EXISTS "anon_all_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "anon_all_sla_config" ON sla_config;
DROP POLICY IF EXISTS "anon_all_holidays" ON holidays;
DROP POLICY IF EXISTS "anon_all_broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "anon_all_notifications" ON notifications;

-- ── 1. RPC PORTAL PUBLIK ──

-- Lacak tiket (guest): kembalikan hanya kolom aman + nama teknisi.
CREATE OR REPLACE FUNCTION get_ticket_for_tracking(p_code text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'status', t.status,
    'site', coalesce(t.site, '-'),
    'unit', coalesce(t.unit, '-'),
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'technician_name', u.full_name
  )
  FROM tickets t
  LEFT JOIN users u ON u.id = t.assigned_to
  WHERE t.code = p_code;
$$;

-- Submit tiket publik: validasi + insert ticket/activities di sisi server (BR-112).
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
  i int;
  j int;
BEGIN
  IF p_reporter_name IS NULL OR trim(p_reporter_name) = '' OR
     p_site IS NULL OR trim(p_site) = '' OR
     p_unit IS NULL OR trim(p_unit) = '' OR
     p_description IS NULL OR trim(p_description) = '' THEN
    RETURN json_build_object('error', 'Semua field wajib diisi.');
  END IF;

  FOR i IN 1..10 LOOP
    v_code := 'ATC-' || to_char(now(), 'YYYYMMDD') || '-';
    FOR j IN 1..4 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * 34)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM tickets WHERE code = v_code);
  END LOOP;

  BEGIN
    INSERT INTO tickets (code, customer, company, site, unit, location, category, description, status, priority, created_by)
    VALUES (v_code, p_reporter_name, p_site, p_site, p_unit, p_site, p_unit,
            'Jabatan: ' || coalesce(p_position, '') || E'\nWA Pelapor: ' || coalesce(p_phone, '') || E'\n\n' || p_description,
            'NEW', 'P2', NULL)
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

  RETURN json_build_object('code', v_code);
END $$;

-- ── 2. RPC INTERNAL ──

-- Delivery broadcast: resolve penerima + insert notifications + flip status.
-- SECURITY DEFINER agar notifications bisa diisi untuk user lain di balik RLS owner.
CREATE OR REPLACE FUNCTION deliver_broadcast(bid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec broadcasts%ROWTYPE;
  v_uid uuid;
BEGIN
  SELECT * INTO v_rec FROM broadcasts WHERE id = bid AND status = 'terjadwal';
  IF NOT FOUND THEN RETURN; END IF;

  FOR v_uid IN
    SELECT id FROM users
    WHERE is_deleted = false
      AND (v_rec.recipients = 'semua' OR role = v_rec.recipients)
  LOOP
    INSERT INTO notifications (user_id, title, message)
    VALUES (v_uid, v_rec.title, v_rec.message);
  END LOOP;

  UPDATE broadcasts SET status = 'terkirim' WHERE id = bid;
END $$;

REVOKE EXECUTE ON FUNCTION deliver_broadcast(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION deliver_broadcast(uuid) TO authenticated;

-- Manajemen user (Admin): insert/update baris public.users.
-- Mencegah eskalasi via self-update (grant ke authenticated hanya last_login).
CREATE OR REPLACE FUNCTION admin_save_user(
  p_id uuid,
  p_email text,
  p_username text,
  p_name text,
  p_wa_number text,
  p_role text,
  p_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM users WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RETURN json_build_object('error', 'Akses ditolak: hanya Admin');
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE id = p_id) THEN
    UPDATE users
    SET username = p_username, name = p_name, full_name = p_name,
        wa_number = p_wa_number, role = p_role, status = p_status,
        updated_at = now()
    WHERE id = p_id;
  ELSE
    INSERT INTO users (id, email, username, name, full_name, wa_number, role, status, must_change_password, is_deleted)
    VALUES (p_id, p_email, p_username, p_name, p_name, p_wa_number, p_role, p_status, true, false);
  END IF;

  RETURN json_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION admin_save_user(uuid,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_save_user(uuid,text,text,text,text,text,text) TO authenticated;

-- ── 3. USERS ──
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
REVOKE SELECT ON users FROM anon;
GRANT SELECT (email) ON users TO anon;  -- hanya email (dipakai lookup login)
REVOKE INSERT, UPDATE, DELETE ON users FROM anon, authenticated;
GRANT UPDATE (last_login) ON users TO authenticated;

CREATE POLICY "users_select_anon_email" ON users FOR SELECT TO anon USING (true);
CREATE POLICY "users_select_authenticated" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_update_self_lastlogin" ON users FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ── 4. TICKETS ──
-- Tanpa policy INSERT untuk anon: portal publik masuk lewat RPC SECURITY DEFINER
-- (create_public_ticket), RLS default-deny mencegah insert tiket liar langsung.
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_select_teknisi_assigned" ON tickets FOR SELECT TO authenticated USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'teknisi' AND assigned_to = auth.uid()
);
CREATE POLICY "tickets_select_staff" ON tickets FOR SELECT TO authenticated USING (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'helpdesk', 'pm')
);
CREATE POLICY "tickets_insert_authenticated" ON tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tickets_update_authenticated" ON tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── 5. ACTIVITIES ──
-- Tanpa policy INSERT untuk anon (sama seperti tickets, via RPC).
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities_select_teknisi_assigned" ON activities FOR SELECT TO authenticated USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'teknisi'
  AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = activities.ticket_id AND t.assigned_to = auth.uid())
);
CREATE POLICY "activities_select_staff" ON activities FOR SELECT TO authenticated USING (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'helpdesk', 'pm')
);
CREATE POLICY "activities_insert_authenticated" ON activities FOR INSERT TO authenticated WITH CHECK (true);

-- ── 6. NOTIFICATIONS (owner-scope; insert via deliver_broadcast) ──
CREATE POLICY "notifications_select_owner" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update_owner" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 7. BROADCASTS ──
CREATE POLICY "broadcasts_select_authenticated" ON broadcasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "broadcasts_insert_admin" ON broadcasts FOR INSERT TO authenticated WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
CREATE POLICY "broadcasts_update_admin" ON broadcasts FOR UPDATE TO authenticated USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin') WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
CREATE POLICY "broadcasts_delete_admin" ON broadcasts FOR DELETE TO authenticated USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ── 8. AUDIT LOGS ──
CREATE POLICY "audit_insert_authenticated" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_select_staff" ON audit_logs FOR SELECT TO authenticated USING (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'helpdesk', 'pm')
);

-- ── 9. SLA CONFIG & HOLIDAYS ──
CREATE POLICY "sla_select_authenticated" ON sla_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "sla_write_admin" ON sla_config FOR ALL TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "holidays_select_authenticated" ON holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays_write_admin" ON holidays FOR ALL TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ── 10. MASTER DATA ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','regions','sites','units']
  LOOP
    EXECUTE format('CREATE POLICY "md_select_authenticated" ON %I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format(
      'CREATE POLICY "md_write_admin" ON %I FOR ALL TO authenticated USING ((SELECT role FROM users WHERE id = auth.uid()) = ''admin'') WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = ''admin'')',
      t
    );
  END LOOP;
END $$;
