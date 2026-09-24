-- ============================================================
-- 43: Notifikasi multi-role + pulihkan fitur auto-close + tutup celah notif.
-- Migration 19/21 ternyata belum pernah diterapkan di DB ini (diagnosis:
-- kolom confirm_sent_at & fungsi set_confirm_sent/auto_close_unconfirmed
-- tidak ada). File ini self-contained: menambahkan bagian yang hilang secara
-- idempoten + 3 perbaikan notifikasi.
-- 1) notify_role: user yang role targetnya ada di kolom `roles` (CSV,
--    migration 12) ikut menerima — mengembalikan perilaku migration 17
--    yang dihapus migration 34. Berlaku untuk kombinasi role apa pun.
-- 2) create_internal_ticket: notifikasi dipulihkan (ada versi fix manual di
--    luar folder migration yang menghapusnya; CREATE OR REPLACE menimpa).
-- 3) auto_close_unconfirmed + set_confirm_sent + kolom confirm_sent_at +
--    jadwal cron (dari migration 19 yang belum jalan) — dengan tambahan
--    notif ke penanggung jawab saat auto-close (sebelumnya senyap).
-- ============================================================

-- ── 0. Kolom yang hilang (bagian dari migration 19) ──
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS confirm_sent_at timestamptz;

-- ── 1. notify_role: multi-role ──
CREATE OR REPLACE FUNCTION notify_role(
  p_role text, p_title text, p_message text, p_ticket_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO notifications (user_id, title, message, ticket_id)
  SELECT id, p_title, p_message, p_ticket_id FROM users
  WHERE is_deleted = false
    AND (role = p_role OR p_role = ANY(string_to_array(roles, ',')));
$$;

REVOKE EXECUTE ON FUNCTION notify_role(text, text, text, uuid) FROM PUBLIC, anon;

-- ── 2. create_internal_ticket: notifikasi dipulihkan ──
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF NOT validate_transition(v_role, NULL, p_status) THEN
    RAISE EXCEPTION 'forbidden: role % cannot create ticket', v_role;
  END IF;
  INSERT INTO tickets
    (code, customer, company, site, unit, status, priority, description, category, location, photo_url, created_by)
  VALUES
    (p_code, p_customer, p_company, p_site, p_unit, p_status, p_priority, p_description, p_category, p_location, p_photo_url, v_uid)
  RETURNING * INTO v_row;
  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (v_row.id, v_uid, COALESCE((SELECT full_name FROM users WHERE id = v_uid), ''),
          p_activity_action, p_activity_details);

  IF p_status = 'UNASSIGNED' THEN
    PERFORM notify_role('pm', 'Tiket baru: ' || v_row.code,
      'Tiket ' || v_row.code || ' siap dijadwalkan.');
  -- ponytail: creator helpdesk tidak dapat notif tiketnya sendiri;
  -- tiket internal non-UNASSIGNED yang dibuat role lain → beri tahu helpdesk.
  ELSIF v_role <> 'helpdesk' THEN
    PERFORM notify_role('helpdesk', 'Tiket baru: ' || v_row.code,
      'Tiket ' || v_row.code || ' menunggu validasi.');
  END IF;
  RETURN v_row;
END $$;

REVOKE EXECUTE ON FUNCTION create_internal_ticket(text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_internal_ticket(text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;

-- ── 3. set_confirm_sent: pulihkan dari migration 19 ──
CREATE OR REPLACE FUNCTION set_confirm_sent(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_full_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role NOT IN ('helpdesk', 'pm') THEN
    RAISE EXCEPTION 'forbidden: confirm is helpdesk/pm only';
  END IF;
  UPDATE tickets SET confirm_sent_at = now(), updated_at = now()
  WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;
  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
          'Konfirmasi WA terkirim',
          'Tiket akan auto-close jika pelanggan tidak merespons dalam 1x24 jam.');
END $$;

REVOKE EXECUTE ON FUNCTION set_confirm_sent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_confirm_sent(uuid) TO authenticated;

-- ── 4. auto_close_unconfirmed: pulihkan dari 19 + notif ke penanggung jawab ──
CREATE OR REPLACE FUNCTION auto_close_unconfirmed()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT id, code, assigned_to FROM tickets
    WHERE status = 'RESOLVED'
      AND confirm_sent_at IS NOT NULL
      AND confirm_sent_at <= now() - interval '24 hours'
  LOOP
    UPDATE tickets SET status = 'CLOSED', closed_at = now(), updated_at = now()
    WHERE id = r.id;
    INSERT INTO activities (ticket_id, user_id, user_name, action, details)
    VALUES (r.id, NULL, 'Sistem', 'Ditutup otomatis',
            'AUTO-CLOSE: pelanggan tidak merespons konfirmasi dalam 1x24 jam.');
    IF r.assigned_to IS NOT NULL THEN
      PERFORM notify_user(r.assigned_to, 'Tiket ' || r.code || ' CLOSED (auto)',
        'Tiket ' || r.code || ' ditutup otomatis — pelanggan tidak merespons konfirmasi dalam 1x24 jam.');
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- ── 5. Jadwal cron auto-close (juga dari 19) ──
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('atapcare-auto-close', '0 * * * *', $$SELECT auto_close_unconfirmed()$$);

-- ── Self-check ──
-- F1 diuji langsung; F3 diuji end-to-end via create_public_ticket (jalur
-- insert valid) lalu dimanipulasi ke kondisi auto-close. FK-bypass via
-- session_replication_role (pola migration 34/42).
DO $$
DECLARE
  v_uid_a uuid; v_uid_b uuid;
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
  v_site uuid; v_unit uuid;
  v_res json; v_code text;
  v_n int; v_overloads int;
BEGIN
  SET LOCAL session_replication_role = replica;

  INSERT INTO users (id, email, username, name, full_name, wa_number, role, roles, status, is_deleted)
  VALUES (gen_random_uuid(), 'a-' || v_suffix || '@local', 'a-' || v_suffix,
          'Chk 43 A', 'Chk 43 A', '', 'teknisi', 'teknisi,helpdesk', 'aktif', false)
  RETURNING id INTO v_uid_a;
  INSERT INTO users (id, email, username, name, full_name, wa_number, role, roles, status, is_deleted)
  VALUES (gen_random_uuid(), 'b-' || v_suffix || '@local', 'b-' || v_suffix,
          'Chk 43 B', 'Chk 43 B', '', 'teknisi', NULL, 'aktif', false)
  RETURNING id INTO v_uid_b;

  -- F1: role target di kolom `roles` harus menerima; tanpa roles harus tidak.
  PERFORM notify_role('helpdesk', 'selfcheck43', 'x');
  ASSERT (SELECT count(*) FROM notifications WHERE user_id = v_uid_a AND title = 'selfcheck43') = 1,
         'multi-role harus menerima notif role lain';
  ASSERT (SELECT count(*) FROM notifications WHERE user_id = v_uid_b AND title = 'selfcheck43') = 0,
         'user tanpa roles tidak boleh menerima';
  DELETE FROM notifications WHERE title = 'selfcheck43';

  -- F3: tiket RESOLVED > 24 jam memberi tahu penanggung jawab saat auto-close.
  INSERT INTO sites (name, pic_name, pic_phone) VALUES ('Site SelfCheck 43', 'PIC', '081') RETURNING id INTO v_site;
  INSERT INTO units (site_id, name) VALUES (v_site, 'Unit SelfCheck 43') RETURNING id INTO v_unit;
  SELECT create_public_ticket('Chk 43', '', '', 'Site SelfCheck 43', 'Unit SelfCheck 43', 'auto-close selfcheck')
    INTO v_res;
  v_code := v_res->>'code';
  ASSERT v_code IS NOT NULL, 'create_public_ticket harus sukses';

  UPDATE tickets SET status = 'RESOLVED',
                     confirm_sent_at = now() - interval '25 hours',
                     assigned_to = v_uid_a
  WHERE code = v_code;
  SELECT auto_close_unconfirmed() INTO v_n;
  ASSERT v_n = 1, 'auto_close harus menutup 1 tiket';
  ASSERT (SELECT count(*) FROM notifications WHERE user_id = v_uid_a AND title LIKE '%CLOSED (auto)%') = 1,
         'auto-close harus memberi tahu penanggung jawab';

  ASSERT to_regprocedure('public.set_confirm_sent(uuid)') IS NOT NULL,
         'set_confirm_sent harus ada';

  DELETE FROM notifications WHERE user_id IN (v_uid_a, v_uid_b) OR title LIKE '%' || v_code || '%';
  IF to_regclass('public.ticket_status_history') IS NOT NULL THEN
    DELETE FROM ticket_status_history WHERE ticket_id IN (SELECT id FROM tickets WHERE code = v_code);
  END IF;
  DELETE FROM activities WHERE ticket_id IN (SELECT id FROM tickets WHERE code = v_code);
  DELETE FROM tickets WHERE code = v_code;
  DELETE FROM units WHERE id = v_unit;
  DELETE FROM sites WHERE id = v_site;
  DELETE FROM users WHERE id IN (v_uid_a, v_uid_b);

  SELECT count(*) INTO v_overloads FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'notify_role';
  ASSERT v_overloads = 1, 'notify_role harus tepat 1 fungsi';

  RESET session_replication_role;
END $$;
