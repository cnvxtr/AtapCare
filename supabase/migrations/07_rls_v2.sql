-- ============================================================
-- RLS v2: state-machine + role-scoped writes (tickets & activities).
-- Semua mutasi tiket lewat RPC SECURITY DEFINER; direct DML dicabut.
-- Melengkapi 03_rls.sql (SELECT role-scoped sudah ada).
-- ============================================================

-- ── 1. Drop policy tulis yang terbuka (lubang dari audit) ──
DROP POLICY IF EXISTS "tickets_insert_authenticated" ON tickets;
DROP POLICY IF EXISTS "tickets_update_authenticated" ON tickets;
DROP POLICY IF EXISTS "activities_insert_authenticated" ON activities;

-- ── 2. Cabut direct write. SELECT tetap via policy 03 ──
REVOKE INSERT, UPDATE, DELETE ON tickets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON activities FROM anon, authenticated;

-- ── 3. State machine murni (bisa di-selfcheck tanpa JWT) ──
CREATE OR REPLACE FUNCTION validate_transition(p_role text, p_from text, p_to text)
RETURNS boolean
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  -- p_from NULL = pembuatan tiket baru
  IF p_from IS NULL THEN
    RETURN p_role IN ('helpdesk', 'pm');
  END IF;
  -- no-op: tidak ada perubahan status
  IF p_from = p_to THEN
    RETURN true;
  END IF;

  IF p_role = 'helpdesk' THEN
    RETURN
      (p_to IN ('VOID', 'DUPLICATE')
         AND p_from NOT IN ('CLOSED', 'VOID', 'DUPLICATE'))
      OR (p_from = 'NEW' AND p_to = 'OPEN')
      OR (p_from = 'OPEN' AND p_to IN ('UNASSIGNED', 'RESOLVED', 'CLOSED'))
      OR (p_from = 'RESOLVED' AND p_to IN ('CLOSED', 'WORKING')) -- rework (alasan wajib)
      OR (p_from = 'CLOSED' AND p_to = 'WORKING');               -- reopen
  END IF;

  IF p_role = 'pm' THEN
    RETURN
      (p_from = 'UNASSIGNED' AND p_to = 'SCHEDULED')
      OR (p_from = 'SCHEDULED' AND p_to IN ('UNASSIGNED', 'SCHEDULED'))
      OR (p_from = 'EN_ROUTE' AND p_to IN ('UNASSIGNED', 'SCHEDULED')) -- re-assign
      OR (p_from = 'WORKING' AND p_to IN ('UNASSIGNED', 'PENDING'))
      OR (p_from = 'PENDING' AND p_to = 'WORKING');
  END IF;

  IF p_role = 'teknisi' THEN
    RETURN
      (p_from = 'SCHEDULED' AND p_to = 'EN_ROUTE')
      OR (p_from = 'EN_ROUTE' AND p_to = 'WORKING')
      OR (p_from = 'WORKING' AND p_to IN ('RESOLVED', 'PENDING'))
      OR (p_from = 'PENDING' AND p_to = 'WORKING');
  END IF;

  RETURN false;
END $$;

-- ── 4. RPC: buat tiket internal (Helpdesk/PM) ──
CREATE OR REPLACE FUNCTION create_internal_ticket(
  p_code text, p_customer text, p_company text, p_site text, p_unit text,
  p_status text, p_priority text, p_category text, p_location text,
  p_description text, p_photo_url text, p_activity_action text, p_activity_details text
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
    (code, customer, company, site, unit, status, priority, category, location, description, photo_url, created_by)
  VALUES
    (p_code, p_customer, p_company, p_site, p_unit, p_status, p_priority, p_category, p_location, p_description, p_photo_url, v_uid)
  RETURNING * INTO v_row;
  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (v_row.id, v_uid, COALESCE((SELECT full_name FROM users WHERE id = v_uid), ''),
          p_activity_action, p_activity_details);
  RETURN v_row;
END $$;

-- ── 5. RPC: ubah status (state machine + role gate) ──
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS NULL THEN RAISE EXCEPTION 'forbidden: user has no role'; END IF;

  SELECT status, (assigned_to = v_uid) INTO v_old_status, v_own
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
END $$;

-- ── 6. RPC: assign/reassign (PM only) ──
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'pm' THEN
    RAISE EXCEPTION 'forbidden: assign is PM only';
  END IF;

  SELECT status INTO v_old_status FROM tickets WHERE id = p_ticket_id;
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
END $$;

-- ── 7. Hanya authenticated yang boleh memanggil RPC ini ──
REVOKE EXECUTE ON FUNCTION validate_transition(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION create_internal_ticket(text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION update_ticket_status(uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION assign_ticket(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION validate_transition(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_internal_ticket(text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_ticket_status(uuid, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_ticket(uuid, uuid, text, text) TO authenticated;
