-- Migration 68: Pengajuan pending kini butuh PERSETUJUAN PM dulu.
-- Alur: teknisi ajukan (tiket TETAP WORKING/EN_ROUTE + flag pending_requested_at)
--  → PM tentukan Boleh Pending (tiket jadi PENDING) atau Tidak Boleh (flag dibersihkan).
--  → PM juga bisa Veto Pending (PENDING → WORKING) kapan saja.
-- Flag otomatis dibersihkan bila tiket keluar dari WORKING/EN_ROUTE (mis. diselesaikan).

-- ── 0. Kolom penanda pengajuan yang masih menunggu ──
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pending_requested_at timestamptz;

-- ── 1. request_pending: teknisi ajukan pending, tiket TIDAK berubah status ──
CREATE OR REPLACE FUNCTION request_pending(
  p_ticket_id uuid,
  p_reason text,
  p_photo_paths text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_status text;
  v_code text;
  v_member boolean;
  v_full_name text;
  v_details text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'teknisi' THEN
    RAISE EXCEPTION 'forbidden: request pending adalah aksi teknisi';
  END IF;

  SELECT status, code INTO v_status, v_code
  FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF v_status NOT IN ('EN_ROUTE', 'WORKING') THEN
    RAISE EXCEPTION 'forbidden: pending hanya bisa diajukan saat EN_ROUTE atau WORKING';
  END IF;
  IF (SELECT pending_requested_at FROM tickets WHERE id = p_ticket_id) IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden: sudah ada pengajuan pending yang belum diputus PM';
  END IF;
  IF COALESCE(p_reason, '') = '' AND COALESCE(p_photo_paths, '') = '' THEN
    RAISE EXCEPTION 'pending butuh alasan atau foto bukti';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM ticket_assignments ta
    WHERE ta.ticket_id = p_ticket_id AND ta.user_id = v_uid
  ) INTO v_member;
  IF NOT v_member AND (SELECT assigned_to FROM tickets WHERE id = p_ticket_id) <> v_uid THEN
    RAISE EXCEPTION 'forbidden: teknisi hanya bisa mengajukan untuk tiket sendiri';
  END IF;

  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;

  v_details := 'Ditunda: ' || NULLIF(p_reason, '');
  IF COALESCE(p_photo_paths, '') <> '' THEN
    v_details := v_details || E'\nFoto:\n' || p_photo_paths;
  END IF;

  UPDATE tickets SET pending_requested_at = now(), updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
          'Pengajuan pending', v_details);

  PERFORM notify_role('pm', 'Pengajuan pending: ' || v_code,
    'Teknisi ' || COALESCE(v_full_name, '-') || ' mengajukan pending untuk tiket '
    || v_code || '. Alasan: ' || COALESCE(p_reason, '-') || ' — perlu persetujuan PM.');

  RETURN jsonb_build_object('ok', true);
END $$;

-- ── 2. approve_pending: PM setuju → tiket benar-benar PENDING ──
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
  IF v_status NOT IN ('EN_ROUTE', 'WORKING')
     OR (SELECT pending_requested_at FROM tickets WHERE id = p_ticket_id) IS NULL THEN
    RAISE EXCEPTION 'forbidden: tidak ada pengajuan pending yang menunggu';
  END IF;

  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;

  UPDATE tickets SET status = 'PENDING', pending_requested_at = NULL, updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
          'Pengajuan pending disetujui PM', NULLIF(p_note, ''));

  IF v_assignee IS NOT NULL THEN
    PERFORM notify_user(v_assignee, 'Pengajuan pending disetujui: ' || v_code,
      'Tiket ' || v_code || ': PM menyetujui pengajuan pending — tiket dijeda.'
      || COALESCE(E'\nCatatan PM: ' || NULLIF(p_note, ''), ''));
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

-- ── 3. reject_pending: PM tidak setuju → tiket TETAP WORKING, pengajuan bersih ──
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
  IF v_status NOT IN ('EN_ROUTE', 'WORKING')
     OR (SELECT pending_requested_at FROM tickets WHERE id = p_ticket_id) IS NULL THEN
    RAISE EXCEPTION 'forbidden: tidak ada pengajuan pending yang menunggu';
  END IF;

  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;

  UPDATE tickets SET pending_requested_at = NULL, updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
          'Pengajuan pending ditolak PM', v_note);

  IF v_assignee IS NOT NULL THEN
    PERFORM notify_user(v_assignee, 'Pengajuan pending ditolak: ' || v_code,
      'Tiket ' || v_code || ': PM tidak menyetujui pengajuan pending — lanjutkan pekerjaan.'
      || COALESCE(E'\nCatatan PM: ' || v_note, ''));
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

-- ── 4. Flag otomatis bersih saat tiket keluar dari WORKING/EN_ROUTE ──
CREATE OR REPLACE FUNCTION clear_pending_request()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> NEW.status AND NEW.status NOT IN ('WORKING', 'EN_ROUTE') THEN
    NEW.pending_requested_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tickets_clear_pending_request ON tickets;
CREATE TRIGGER tickets_clear_pending_request
BEFORE UPDATE ON tickets
FOR EACH ROW
WHEN (OLD.pending_requested_at IS NOT NULL)
EXECUTE FUNCTION clear_pending_request();

REVOKE EXECUTE ON FUNCTION request_pending(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION request_pending(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION approve_pending(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION approve_pending(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION reject_pending(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reject_pending(uuid, text) TO authenticated;