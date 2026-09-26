-- ============================================================
-- 79: Nama pelapor di notifikasi (helpdesk & teknisi).
-- Tambahkan identitas pelapor ke pesan notifikasi agar lebih
-- mudah dikenali (kode tiket saja sulit dihafal teknisi).
-- CREATE OR REPLACE mempertahankan GRANT eksisting.
-- Jalankan setelah 59_customer_company_code.sql (create_public_ticket)
-- & 20_ticket_assignments.sql (assign_ticket).
-- ============================================================

-- ── 1. create_public_ticket: helpdesk tahu siapa pelapor ──
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
  v_caller uuid := auth.uid();
  v_user_customer_id uuid;
  v_company_name text;
  i int;
  j int;
BEGIN
  SET LOCAL row_security = off;

  IF p_reporter_name IS NULL OR trim(p_reporter_name) = '' OR
     p_site IS NULL OR trim(p_site) = '' OR
     p_unit IS NULL OR trim(p_unit) = '' OR
     p_description IS NULL OR trim(p_description) = '' THEN
    RETURN json_build_object('error', 'Semua field wajib diisi.');
  END IF;

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

  IF v_caller IS NOT NULL THEN
    SELECT customer_id INTO v_user_customer_id FROM users WHERE id = v_caller;

    IF v_user_customer_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM sites s
        JOIN customers c ON c.id = s.customer_id
        WHERE s.customer_id = v_user_customer_id
          AND s.is_deleted = false
          AND s.name = p_site
      ) THEN
        RETURN json_build_object('error', 'Site tidak tersedia untuk akun Anda.');
      END IF;

      SELECT name INTO v_company_name FROM customers WHERE id = v_user_customer_id;
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
    INSERT INTO tickets (code, customer, company, site, unit, location, category, description, status, priority, created_by, created_by_user_id)
    VALUES (v_code, p_reporter_name,
            coalesce(v_company_name, p_site),
            p_site, p_unit, p_site, p_unit,
            'Jabatan: ' || coalesce(p_position, '') || E'\nWA Pelapor: ' || coalesce(p_phone, '') || E'\n\n' || p_description,
            'NEW', NULL, NULL, v_caller)
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
    'Tiket ' || v_code || ' dari ' || p_site || ' (' || p_unit || ') oleh ' || p_reporter_name || ' menunggu validasi.');

  IF v_caller IS NOT NULL THEN
    PERFORM notify_user(v_caller, 'Tiket ' || v_code || ' diterima',
      'Tiket ' || v_code || ' berhasil dibuat dan menunggu validasi.');
  END IF;

  RETURN json_build_object('code', v_code);
END $$;

-- ── 2. assign_ticket: teknisi tahu lokasi + pelapor ──
CREATE OR REPLACE FUNCTION assign_ticket(
  p_ticket_id uuid, p_technician_id uuid, p_activity_action text DEFAULT NULL,
  p_activity_details text DEFAULT NULL, p_support_ids uuid[] DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_old_status text;
  v_new_status text;
  v_full_name text;
  v_code text;
  v_site text;
  v_unit text;
  v_customer text;
  v_support uuid;
  v_names text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'pm' THEN
    RAISE EXCEPTION 'forbidden: assign is PM only';
  END IF;

  SELECT status, code, site, unit, customer
    INTO v_old_status, v_code, v_site, v_unit, v_customer
  FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  v_new_status := CASE WHEN p_technician_id IS NOT NULL THEN 'SCHEDULED' ELSE 'UNASSIGNED' END;
  IF NOT validate_transition(v_role, v_old_status, v_new_status) THEN
    RAISE EXCEPTION 'forbidden: pm cannot transition % -> %', v_old_status, v_new_status;
  END IF;

  UPDATE tickets SET assigned_to = p_technician_id, status = v_new_status, updated_at = now()
  WHERE id = p_ticket_id;

  DELETE FROM ticket_assignments WHERE ticket_id = p_ticket_id;
  IF p_technician_id IS NOT NULL THEN
    INSERT INTO ticket_assignments (ticket_id, user_id, role) VALUES (p_ticket_id, p_technician_id, 'lead');
    IF p_support_ids IS NOT NULL THEN
      FOREACH v_support IN ARRAY p_support_ids LOOP
        IF v_support IS DISTINCT FROM p_technician_id
           AND NOT EXISTS (SELECT 1 FROM ticket_assignments ta WHERE ta.ticket_id = p_ticket_id AND ta.user_id = v_support) THEN
          INSERT INTO ticket_assignments (ticket_id, user_id, role) VALUES (p_ticket_id, v_support, 'teknisi');
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF p_support_ids IS NOT NULL THEN
    SELECT string_agg(full_name, ', ' ORDER BY full_name) INTO v_names
    FROM users WHERE id = ANY(p_support_ids) AND id IS DISTINCT FROM p_technician_id;
    IF v_names IS NOT NULL THEN
      p_activity_details := COALESCE(p_activity_details, '') || E'\nPendukung: ' || v_names;
    END IF;
  END IF;

  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;
  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
          COALESCE(p_activity_action,
                  CASE WHEN p_technician_id IS NOT NULL
                        THEN 'Tiket ditugaskan' ELSE 'Penugasan dibatalkan' END),
          p_activity_details);

  IF p_technician_id IS NOT NULL THEN
    PERFORM notify_user(p_technician_id,
      'Tugas baru: ' || v_code,
      'Tiket ' || v_code || ' — ' || v_site || ' (' || v_unit || '), atas nama ' || v_customer || ' — ditugaskan kepada Anda.');
    IF p_support_ids IS NOT NULL THEN
      FOREACH v_support IN ARRAY p_support_ids LOOP
        IF v_support IS DISTINCT FROM p_technician_id THEN
          PERFORM notify_user(v_support,
            'Tugas pendukung: ' || v_code,
            'Anda ditugaskan sebagai pendukung tiket ' || v_code || '.');
        END IF;
      END LOOP;
    END IF;
  END IF;
END $$;

-- ── Hak eksekusi (CREATE OR REPLACE mempertahankan GRANT; tegaskan ulang ──
REVOKE EXECUTE ON FUNCTION create_public_ticket(text, text, text, text, text, text, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION assign_ticket(uuid, uuid, text, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_public_ticket(text, text, text, text, text, text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION assign_ticket(uuid, uuid, text, text, uuid[]) TO authenticated;

-- ── VERIFIKASI ringan: nama pelapor hadir di kedua fungsi ──
SELECT
  pg_get_functiondef('create_public_ticket(text, text, text, text, text, text, text[])'::regprocedure) LIKE '%p_reporter_name || %' AS create_public_has_reporter,
  pg_get_functiondef('assign_ticket(uuid, uuid, text, text, uuid[])'::regprocedure) LIKE '%atas nama %' AS assign_has_reporter;