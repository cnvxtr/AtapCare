-- ============================================================
-- 24: Duplicate terstruktur (duplicate_of) (Fase 3).
-- Relasi tiket duplikat -> tiket utama, bukan hanya teks activity.
-- update_ticket_status didefinisikan ulang kumulatif (pola 17/19)
-- dengan param baru p_duplicate_of; signature lama di-drop agar
-- tidak ada overload ambigu. Pemanggil lama tetap valid (param
-- baru DEFAULT NULL).
-- Jalankan setelah 23_portal_stats.sql.
-- ============================================================

-- ── 1. Kolom relasi duplikat ──
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES tickets(id);

CREATE INDEX IF NOT EXISTS idx_tickets_duplicate_of ON tickets(duplicate_of);

-- ── 2. update_ticket_status: tautkan tiket utama saat DUPLICATE ──
DROP FUNCTION IF EXISTS update_ticket_status(uuid, text, text, text, text, text, text);

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
    RAISE EXCEPTION 'forbidden: teknisi can only act on own ticket';
  END IF;

  IF NOT validate_transition(v_role, v_old_status, p_new_status) THEN
    RAISE EXCEPTION 'forbidden: % cannot transition % -> %', v_role, v_old_status, p_new_status;
  END IF;

  -- Reopen CLOSED hanya dalam 7 hari (BR Lampiran A).
  IF v_old_status = 'CLOSED' AND p_new_status = 'WORKING' THEN
    IF (SELECT closed_at FROM tickets WHERE id = p_ticket_id) < now() - interval '7 days' THEN
      RAISE EXCEPTION 'forbidden: closed more than 7 days, cannot reopen';
    END IF;
  END IF;

  -- Relasi duplikat: hanya saat menandai DUPLICATE, bukan self, target harus ada.
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

-- ── 3. Hak eksekusi (signature baru) ──
REVOKE EXECUTE ON FUNCTION update_ticket_status(uuid, text, text, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_ticket_status(uuid, text, text, text, text, text, text, uuid) TO authenticated;
