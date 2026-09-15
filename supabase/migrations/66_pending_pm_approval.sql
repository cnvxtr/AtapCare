-- Migration 66: Pengajuan Pending → persetujuan PM.
-- 1) Notif PM saat pending kini membawa NAMA teknisi + ALASAN (dari aktivitas "Ditunda:").
-- 2) approve_pending: PM menyetujui pending (tiket tetap PENDING) + catatan opsional.
-- 3) reject_pending: PM menolak pending (tiket kembali WORKING) + catatan opsional.

-- ── 1. update_ticket_status (revisi cabang PENDING; body = migration 61) ──
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

  -- FRT: hitung saat helpdesk buka tiket (NEW → OPEN)
  IF p_new_status = 'OPEN' AND v_old_status = 'NEW' THEN
    PERFORM set_frt_on_open(p_ticket_id);
  END IF;

  -- NOTIFIKASI EXISTING (helpdesk, pm, teknisi)
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
    SELECT COALESCE(NULLIF(split_part(a.details, ' | Foto', 1), ''), a.details)
      INTO v_reason
    FROM activities a
    WHERE a.ticket_id = p_ticket_id AND a.details LIKE 'Ditunda:%'
    ORDER BY a.created_at DESC
    LIMIT 1;
    PERFORM notify_role('pm', 'Pengajuan pending: ' || v_code,
      'Tiket ' || v_code || ' dijeda oleh ' || COALESCE(v_full_name, 'teknisi')
      || '. Alasan: ' || COALESCE(v_reason, '-') || ' — perlu persetujuan PM.');
  ELSIF p_new_status = 'WORKING' AND v_old_status IN ('RESOLVED', 'CLOSED') AND v_assignee IS NOT NULL THEN
    PERFORM notify_user(v_assignee, 'Rework: ' || v_code,
      'Tiket ' || v_code || ' dikembalikan untuk perbaikan ulang.');
  ELSIF p_new_status IN ('CLOSED', 'VOID', 'DUPLICATE') AND v_assignee IS NOT NULL THEN
    PERFORM notify_user(v_assignee, 'Tiket ' || v_code || ' ' || p_new_status,
      'Tiket ' || v_code || ' berstatus ' || p_new_status || '.');
  END IF;

  -- NOTIFIKASI CUSTOMER (hanya ke creator tiket)
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

  -- NOTIFIKASI EXECUTIVE (hanya tiket penting)
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

REVOKE EXECUTE ON FUNCTION update_ticket_status(uuid, text, text, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_ticket_status(uuid, text, text, text, text, text, text, uuid) TO authenticated;

-- ── 2. approve_pending: tiket tetap PENDING ──
CREATE OR REPLACE FUNCTION approve_pending(
  p_ticket_id uuid,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_status text;
  v_code text;
  v_assignee uuid;
  v_full_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS NULL THEN RAISE EXCEPTION 'forbidden: user has no role'; END IF;
  IF v_role NOT IN ('pm', 'admin') THEN RAISE EXCEPTION 'forbidden: pm only'; END IF;

  SELECT t.status, t.code, t.assigned_to
    INTO v_status, v_code, v_assignee
  FROM tickets t WHERE t.id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF v_status <> 'PENDING' THEN RAISE EXCEPTION 'forbidden: tiket tidak dalam status pending'; END IF;

  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;

  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
          'Pengajuan pending disetujui PM',
          NULLIF(p_note, ''));

  IF v_assignee IS NOT NULL THEN
    PERFORM notify_user(v_assignee, 'Pengajuan pending disetujui: ' || v_code,
      'Tiket ' || v_code || ': PM menyetujui pengajuan pending.'
      || COALESCE(E'\nCatatan PM: ' || NULLIF(p_note, ''), ''));
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

-- ── 3. reject_pending: tiket kembali WORKING ──
CREATE OR REPLACE FUNCTION reject_pending(
  p_ticket_id uuid,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_status text;
  v_code text;
  v_assignee uuid;
  v_note text := NULLIF(p_note, '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS NULL THEN RAISE EXCEPTION 'forbidden: user has no role'; END IF;
  IF v_role NOT IN ('pm', 'admin') THEN RAISE EXCEPTION 'forbidden: pm only'; END IF;

  SELECT t.status, t.code, t.assigned_to
    INTO v_status, v_code, v_assignee
  FROM tickets t WHERE t.id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF v_status <> 'PENDING' THEN RAISE EXCEPTION 'forbidden: tiket tidak dalam status pending'; END IF;

  PERFORM update_ticket_status(p_ticket_id, 'WORKING', NULL, NULL, NULL,
    'Pending ditolak PM',
    COALESCE(v_note, 'Lanjutkan pekerjaan tiket.'));

  IF v_assignee IS NOT NULL THEN
    PERFORM notify_user(v_assignee, 'Pengajuan pending ditolak: ' || v_code,
      'Tiket ' || v_code || ': PM tidak menyetujui pengajuan pending — lanjutkan pekerjaan.'
      || COALESCE(E'\nCatatan PM: ' || v_note, ''));
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION approve_pending(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION approve_pending(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION reject_pending(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reject_pending(uuid, text) TO authenticated;
