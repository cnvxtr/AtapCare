-- Migration 49: Notifikasi ke Customer (creator tiket) dan Executive.
-- Customer: notif saat tiket diterima, selesai, ditutup, dibatalkan, duplikat, rework.
-- Executive: notif saat tiket critical masuk pipeline, selesai, pending > 48 jam.

-- ── 1. update_ticket_status: tambah notifikasi customer + executive ──
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS NULL THEN RAISE EXCEPTION 'forbidden: user has no role'; END IF;

  SELECT status, (assigned_to = v_uid), code, assigned_to, created_by_user_id, priority, site
    INTO v_old_status, v_own, v_code, v_assignee, v_created_by, v_priority, v_site
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

  -- ═══════════════════════════════════════════════════════════
  -- NOTIFIKASI EXISTING (helpdesk, pm, teknisi)
  -- ═══════════════════════════════════════════════════════════
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

  -- ═══════════════════════════════════════════════════════════
  -- NOTIFIKASI CUSTOMER (hanya ke creator tiket)
  -- ═══════════════════════════════════════════════════════════
  IF v_created_by IS NOT NULL AND v_created_by <> v_uid THEN
    IF p_new_status = 'OPEN' AND v_old_status = 'NEW' THEN
      PERFORM notify_user(v_created_by, 'Tiket ' || v_code || ' diterima',
        'Tiket ' || v_code || ' telah diterima dan sedang diproses.');
    ELSIF p_new_status = 'RESOLVED' THEN
      PERFORM notify_user(v_created_by, 'Tiket ' || v_code || ' selesai',
        'Tiket ' || v_code || ' telah selesai dikerjakan. Silakan konfirmasi.');
    ELSIF p_new_status = 'CLOSED' THEN
      PERFORM notify_user(v_created_by, 'Tiket ' || v_code || ' ditutup',
        'Tiket ' || v_code || ' telah ditutup.');
    ELSIF p_new_status = 'VOID' THEN
      PERFORM notify_user(v_created_by, 'Tiket ' || v_code || ' dibatalkan',
        'Tiket ' || v_code || ' telah dibatalkan.');
    ELSIF p_new_status = 'DUPLICATE' THEN
      PERFORM notify_user(v_created_by, 'Tiket ' || v_code || ' duplikat',
        'Tiket ' || v_code || ' ditandai sebagai duplikat.');
    ELSIF p_new_status = 'WORKING' AND v_old_status IN ('RESOLVED', 'CLOSED') THEN
      PERFORM notify_user(v_created_by, 'Tiket ' || v_code || ' dalam perbaikan',
        'Tiket ' || v_code || ' sedang dalam perbaikan ulang.');
    END IF;
  END IF;

  -- ═══════════════════════════════════════════════════════════
  -- NOTIFIKASI EXECUTIVE (hanya tiket penting)
  -- ═══════════════════════════════════════════════════════════
  IF p_new_status = 'UNASSIGNED' AND v_old_status = 'NEW' AND v_priority = 'Critical' THEN
    PERFORM notify_role('executive', 'Tiket Critical: ' || v_code,
      'Tiket ' || v_code || ' (Critical) dari ' || COALESCE(v_site, '-') || ' masuk ke pipeline.');
  ELSIF p_new_status = 'RESOLVED' THEN
    PERFORM notify_role('executive', 'Tiket selesai: ' || v_code,
      'Tiket ' || v_code || ' telah selesai dikerjakan.');
  ELSIF p_new_status IN ('CLOSED', 'VOID') THEN
    PERFORM notify_role('executive', 'Tiket ' || v_code || ' ' || p_new_status,
      'Tiket ' || v_code || ' berstatus ' || p_new_status || '.');
  END IF;
END $$;

-- ── 2. pending_alarm: tambah executive ke target notifikasi ──
CREATE OR REPLACE FUNCTION pending_alarm()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT id, code FROM tickets
    WHERE status = 'PENDING'
      AND pending_alarm_sent_at IS NULL
      AND updated_at <= now() - interval '48 hours'
  LOOP
    UPDATE tickets SET pending_alarm_sent_at = now(), updated_at = now() WHERE id = r.id;
    PERFORM notify_role('pm', 'Pending > 48 jam: ' || r.code,
      'Tiket ' || r.code || ' menunggu lebih dari 48 jam. Segera tindak lanjuti.');
    PERFORM notify_role('helpdesk', 'Pending > 48 jam: ' || r.code,
      'Tiket ' || r.code || ' menunggu lebih dari 48 jam. Segera tindak lanjuti.');
    PERFORM notify_role('executive', 'Pending > 48 jam: ' || r.code,
      'Tiket ' || r.code || ' masih PENDING lebih dari 48 jam.');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
