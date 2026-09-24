-- ============================================================
-- 19: Auto-close 24 jam (K3) + guard reopen 7 hari (K5).
-- Jalankan setelah 17_event_notifications.sql (update_ticket_status
-- didefinisikan ulang di sini, cumulative).
-- ============================================================

-- ── 1. Kolom: kapan konfirmasi WA terkirim (Jalur B) ──
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS confirm_sent_at timestamptz;

-- ── 2. RPC: tandai konfirmasi WA terkirim (helpdesk/pm) ──
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

-- ── 3. Job: tutup otomatis RESOLVED + confirm_sent_at >= 24 jam ──
CREATE OR REPLACE FUNCTION auto_close_unconfirmed()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT id, code FROM tickets
    WHERE status = 'RESOLVED'
      AND confirm_sent_at IS NOT NULL
      AND confirm_sent_at <= now() - interval '24 hours'
  LOOP
    UPDATE tickets SET status = 'CLOSED', closed_at = now(), updated_at = now()
    WHERE id = r.id;
    INSERT INTO activities (ticket_id, user_id, user_name, action, details)
    VALUES (r.id, NULL, 'Sistem', 'Ditutup otomatis',
            'AUTO-CLOSE: pelanggan tidak merespons konfirmasi dalam 1x24 jam.');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- ── 4. Jadwal pg_cron: setiap jam ──
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('atapcare-auto-close', '0 * * * *', $$SELECT auto_close_unconfirmed()$$);

-- ── 5. update_ticket_status: guard reopen 7 hari + flag REWORK utk reopen ──
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

  -- Reopen CLOSED hanya dalam 7 hari (BR Lampiran A).
  IF v_old_status = 'CLOSED' AND p_new_status = 'WORKING' THEN
    IF (SELECT closed_at FROM tickets WHERE id = p_ticket_id) < now() - interval '7 days' THEN
      RAISE EXCEPTION 'forbidden: closed more than 7 days, cannot reopen';
    END IF;
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

-- ── 6. Hak eksekusi ──
REVOKE EXECUTE ON FUNCTION set_confirm_sent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_confirm_sent(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION update_ticket_status(uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_ticket_status(uuid, text, text, text, text, text, text) TO authenticated;
