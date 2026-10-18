-- ============================================================
-- 90: target_role notifikasi untuk pelanggan.
-- Redefinisikan update_ticket_status & create_public_ticket agar
-- notify_user ke pembuat tiket (customer) menyimpan target_role='customer'.
-- ============================================================

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
  v_created_by uuid;
  v_priority text;
  v_site text;
  v_reason text;
  v_pending_requested_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS NULL THEN RAISE EXCEPTION 'forbidden: user has no role'; END IF;

  SELECT status, (assigned_to = v_uid), code, assigned_to, created_by_user_id, priority, site, pending_requested_at
    INTO v_old_status, v_own, v_code, v_assignee, v_created_by, v_priority, v_site, v_pending_requested_at
  FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  IF v_role = 'teknisi' AND v_pending_requested_at IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden: menunggu keputusan PM atas pengajuan pending';
  END IF;

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
    IF (SELECT closed_at IS NULL OR closed_at < now() - interval '7 days'
        FROM tickets WHERE id = p_ticket_id) THEN
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

  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;

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
                        THEN p_duplicate_of ELSE duplicate_of END,
    rating_helpdesk_user_id = CASE WHEN p_new_status = 'OPEN' AND v_old_status = 'NEW'
                                   THEN v_uid ELSE rating_helpdesk_user_id END,
    rating_helpdesk_name = CASE WHEN p_new_status = 'OPEN' AND v_old_status = 'NEW'
                                THEN COALESCE(v_full_name, '') ELSE rating_helpdesk_name END
  WHERE id = p_ticket_id;

  IF p_new_status <> v_old_status THEN
    INSERT INTO activities (ticket_id, user_id, user_name, action, details)
    VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
            COALESCE(p_activity_action, format('Status: %s -> %s', v_old_status, p_new_status)),
            p_activity_details);
  END IF;

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
        ' - menunggu validasi helpdesk.');
    END IF;
  ELSIF p_new_status = 'UNASSIGNED' AND v_role = 'helpdesk' THEN
    PERFORM notify_role('pm', 'Tiket baru: ' || v_code,
      'Tiket ' || v_code || ' menunggu penjadwalan teknisi.');
  ELSIF p_new_status = 'PENDING' THEN
    SELECT COALESCE(NULLIF(split_part(a.details, ' | Foto', 1), ''), a.details)
      INTO v_reason
    FROM activities a
    WHERE a.ticket_id = p_ticket_id AND a.details LIKE 'Ditunda:%'
    ORDER BY a.created_at DESC
    LIMIT 1;
    PERFORM notify_role('pm', 'Pengajuan pending: ' || v_code,
      'Tiket ' || v_code || ' dijeda oleh ' || COALESCE(v_full_name, 'teknisi')
      || '. Alasan: ' || COALESCE(v_reason, '-') || ' - perlu persetujuan PM.');
  ELSIF p_new_status = 'WORKING' AND v_old_status IN ('RESOLVED', 'CLOSED') AND v_assignee IS NOT NULL THEN
    PERFORM notify_user(v_assignee, 'Rework: ' || v_code,
      'Tiket ' || v_code || ' dikembalikan untuk perbaikan ulang.', 'teknisi');
  ELSIF p_new_status IN ('CLOSED', 'VOID', 'DUPLICATE') AND v_assignee IS NOT NULL THEN
    PERFORM notify_user(v_assignee, 'Tiket ' || v_code || ' ' || p_new_status,
      'Tiket ' || v_code || ' berstatus ' || p_new_status || '.', 'teknisi');
  END IF;

  IF v_created_by IS NOT NULL AND v_created_by <> v_uid THEN
    IF p_new_status = 'OPEN' AND v_old_status = 'NEW' THEN
      PERFORM notify_user(v_created_by, 'Tiket ' || v_code || ' diterima',
        'Tiket ' || v_code || ' telah diterima dan sedang diproses.', 'customer');
    ELSIF p_new_status = 'RESOLVED' THEN
      PERFORM notify_user(v_created_by, 'Tiket ' || v_code || ' selesai',
        'Tiket ' || v_code || ' telah selesai dikerjakan. Silakan konfirmasi.', 'customer');
    ELSIF p_new_status = 'CLOSED' THEN
      PERFORM notify_user(v_created_by, 'Tiket ' || v_code || ' ditutup',
        'Tiket ' || v_code || ' telah ditutup.', 'customer');
    ELSIF p_new_status = 'VOID' THEN
      PERFORM notify_user(v_created_by, 'Tiket ' || v_code || ' dibatalkan',
        'Tiket ' || v_code || ' telah dibatalkan.', 'customer');
    ELSIF p_new_status = 'DUPLICATE' THEN
      PERFORM notify_user(v_created_by, 'Tiket ' || v_code || ' duplikat',
        'Tiket ' || v_code || ' ditandai sebagai duplikat.', 'customer');
    ELSIF p_new_status = 'WORKING' AND v_old_status IN ('RESOLVED', 'CLOSED') THEN
      PERFORM notify_user(v_created_by, 'Tiket ' || v_code || ' dalam perbaikan',
        'Tiket ' || v_code || ' sedang dalam perbaikan ulang.', 'customer');
    END IF;
  END IF;
END $$;

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
    'Tiket ' || v_code || ' dari ' || p_site || ' (' || p_unit || ') menunggu validasi.');

  IF v_caller IS NOT NULL THEN
    PERFORM notify_user(v_caller, 'Tiket ' || v_code || ' diterima',
      'Tiket ' || v_code || ' berhasil dibuat dan menunggu validasi.', 'customer');
  END IF;

  RETURN json_build_object('code', v_code);
END $$;

REVOKE EXECUTE ON FUNCTION update_ticket_status(uuid, text, text, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_ticket_status(uuid, text, text, text, text, text, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION create_public_ticket(text, text, text, text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_public_ticket(text, text, text, text, text, text, text[]) TO anon, authenticated;