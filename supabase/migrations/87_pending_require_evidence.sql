-- Migration 87: Pengajuan pending WAJIB menyertakan alasan DAN foto/file bukti.
-- Sebelumnya (migrasi 68) hanya "alasan ATAU foto". UI teknisi sudah mewajibkan
-- keduanya (Tugas.tsx), migrasi ini menutup celah pemanggilan RPC langsung.
-- Efek samping: alasan kini selalu ada, jadi 'Ditunda: ' || reason tidak pernah
-- menjadi NULL (yang tadinya bisa men-NULL-kan seluruh details).

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
  IF COALESCE(p_reason, '') = '' OR COALESCE(p_photo_paths, '') = '' THEN
    RAISE EXCEPTION 'pending butuh alasan dan foto/file bukti';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM ticket_assignments ta
    WHERE ta.ticket_id = p_ticket_id AND ta.user_id = v_uid
  ) INTO v_member;
  IF NOT v_member AND (SELECT assigned_to FROM tickets WHERE id = p_ticket_id) <> v_uid THEN
    RAISE EXCEPTION 'forbidden: teknisi hanya bisa mengajukan untuk tiket sendiri';
  END IF;

  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;

  v_details := 'Ditunda: ' || p_reason;
  v_details := v_details || E'\nFoto:\n' || p_photo_paths;

  UPDATE tickets SET pending_requested_at = now(), updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''), 'Pengajuan pending', v_details);

  PERFORM notify_role('pm', 'Pengajuan pending: ' || v_code,
    'Tiket ' || v_code || ' diajukan pending oleh ' || COALESCE(v_full_name, 'teknisi')
    || '. Alasan: ' || p_reason || ' — perlu persetujuan PM.');

  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION request_pending(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION request_pending(uuid, text, text) TO authenticated;

-- ── Self-check: body fungsi harus memuat pesan guard baru ──
DO $$
BEGIN
  IF position('pending butuh alasan dan foto/file bukti'
      IN pg_get_functiondef('request_pending(uuid,text,text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'FAIL: request_pending belum diperbarui (guard alasan + foto/file tidak ada)';
  END IF;
  RAISE NOTICE 'PASS: request_pending mewajibkan alasan + foto/file bukti';
END $$;
