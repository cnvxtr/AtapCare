-- ============================================================
-- 17: Notifikasi event otomatis (K8).
-- Emit server-side di dalam RPC SECURITY DEFINER sehingga semua
-- jalur mutasi tiket (frontend mana pun) menimbulkan notifikasi.
-- Infrastruktur (tabel notifications + polling badge 30s) sudah ada.
-- Jalankan setelah 12_user_roles.sql (dipakai string_to_array(roles)).
-- ============================================================

-- ── 1. Helper: kirim notifikasi ke satu user ──
CREATE OR REPLACE FUNCTION notify_user(p_uid uuid, p_title text, p_message text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO notifications (user_id, title, message)
  VALUES (p_uid, p_title, p_message);
$$;

-- ── 2. Helper: kirim ke semua user aktif dengan role (mencakup multi-role CSV) ──
CREATE OR REPLACE FUNCTION notify_role(p_role text, p_title text, p_message text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO notifications (user_id, title, message)
  SELECT id, p_title, p_message FROM users
  WHERE is_deleted = false
    AND (role = p_role OR p_role = ANY(string_to_array(roles, ',')));
$$;

-- ── 3. assign_ticket: teknisi dapat tugas ──
CREATE OR REPLACE FUNCTION assign_ticket(
  p_ticket_id uuid, p_technician_id uuid, p_activity_action text DEFAULT NULL,
  p_activity_details text DEFAULT NULL
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'pm' THEN
    RAISE EXCEPTION 'forbidden: assign is PM only';
  END IF;

  SELECT status, code INTO v_old_status, v_code FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  v_new_status := CASE WHEN p_technician_id IS NOT NULL THEN 'SCHEDULED' ELSE 'UNASSIGNED' END;
  IF NOT validate_transition(v_role, v_old_status, v_new_status) THEN
    RAISE EXCEPTION 'forbidden: pm cannot transition % -> %', v_old_status, v_new_status;
  END IF;

  UPDATE tickets SET assigned_to = p_technician_id, status = v_new_status, updated_at = now()
  WHERE id = p_ticket_id;

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
      'Tiket ' || v_code || ' ditugaskan kepada Anda.');
  END IF;
END $$;

-- ── 4. update_ticket_status: RESOLVED → helpdesk+pm; final → teknisi ──
CREATE OR REPLACE FUNCTION update_ticket_status(
  p_ticket_id uuid, p_new_status text, p_new_priority text DEFAULT NULL,
  p_resolved_by text DEFAULT NULL, p_rejection_reason text DEFAULT NULL,
  p_activity_action text DEFAULT NULL, p_activity_details text DEFAULT NULL
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
    RAISE EXCEPTION 'forbidden: teknisi can only act on own ticket';
  END IF;

  IF NOT validate_transition(v_role, v_old_status, p_new_status) THEN
    RAISE EXCEPTION 'forbidden: % cannot transition % -> %', v_role, v_old_status, p_new_status;
  END IF;

  UPDATE tickets SET
    status = p_new_status,
    updated_at = now(),
    priority = COALESCE(p_new_priority, priority),
    resolved_by = COALESCE(p_resolved_by, resolved_by),
    rejection_reason = COALESCE(p_rejection_reason, rejection_reason),
    rework_flag = CASE WHEN p_new_status = 'WORKING' AND v_old_status = 'RESOLVED'
                      THEN true ELSE rework_flag END,
    closed_at = CASE WHEN p_new_status IN ('CLOSED', 'VOID', 'DUPLICATE')
                    THEN now() ELSE closed_at END
  WHERE id = p_ticket_id;

  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;
  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
          COALESCE(p_activity_action, format('Status: %s -> %s', v_old_status, p_new_status)),
          p_activity_details);

  IF p_new_status = 'RESOLVED' THEN
    PERFORM notify_role('helpdesk', 'Validasi penyelesaian: ' || v_code,
      'Tiket ' || v_code || ' menunggu validasi penyelesaian.');
    PERFORM notify_role('pm', 'Validasi penyelesaian: ' || v_code,
      'Tiket ' || v_code || ' menunggu validasi penyelesaian.');
  ELSIF p_new_status IN ('CLOSED', 'VOID', 'DUPLICATE') AND v_assignee IS NOT NULL THEN
    PERFORM notify_user(v_assignee, 'Tiket ' || v_code || ' ' || p_new_status,
      'Tiket ' || v_code || ' berstatus ' || p_new_status || '.');
  END IF;
END $$;

-- ── 5. create_internal_ticket: UNASSIGNED → PM ──
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
  END IF;
  RETURN v_row;
END $$;

-- ── 6. Hak eksekusi (helper hanya dipanggil dari konteks definer) ──
REVOKE EXECUTE ON FUNCTION notify_user(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION notify_role(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION assign_ticket(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION update_ticket_status(uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION create_internal_ticket(text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION assign_ticket(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_ticket_status(uuid, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_internal_ticket(text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;
