-- ============================================================
-- 32: Pending dari EN_ROUTE + foto bukti ke timeline pelanggan.
-- (a) validate_transition: teknisi boleh EN_ROUTE -> PENDING
--     (sebelumnya hanya WORKING -> PENDING).
-- (b) get_public_timeline: tampilkan aksi "Tiket dijeda" + details
--     (alasan + path foto) HANYA untuk baris pending, agar pelanggan
--     melihat alasan penundaan & bukti visual di lapor.atapcare.id.
-- (c) Storage tetap private: anon boleh sign URL hanya foto yang
--     tercantum di aktivitas pending (bukti), bukan semua foto.
-- ============================================================

-- ── (a) State machine: EN_ROUTE -> PENDING ──
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
      OR (p_from = 'EN_ROUTE' AND p_to IN ('WORKING', 'PENDING'))
      OR (p_from = 'WORKING' AND p_to IN ('RESOLVED', 'PENDING'))
      OR (p_from = 'PENDING' AND p_to = 'WORKING');
  END IF;

  RETURN false;
END $$;

-- ── (b) Timeline tamu: + aksi pending (alasan & foto bukti) ──
-- Details hanya dibocorkan untuk baris "Tiket dijeda"; status lain tetap
-- tidak menampilkan details (catatan internal) — diperiksa self-check di bawah.
CREATE OR REPLACE FUNCTION get_public_timeline(p_code text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at), '[]'::json)
  FROM (
    SELECT a.action,
           a.created_at,
           NULLIF(a.user_name, '') AS user_name,
           CASE WHEN a.action = 'Tiket dijeda' THEN a.details END AS details
    FROM tickets tk
    JOIN activities a ON a.ticket_id = tk.id
    WHERE tk.code = p_code
      AND (a.action LIKE 'Tiket dibuat%' OR a.action LIKE 'Status:%' OR a.action = 'Tiket dijeda')
  ) t;
$$;

-- ── (c) anon boleh baca (untuk signed URL) hanya foto bukti pending ──
-- name = path di storage tanpa prefix bucket (mis. ATC-.../uuid.jpg);
-- details pending berisi path yang sama persis setelah "Foto (N):\n".
DROP POLICY IF EXISTS "ticket_photos_select_anon_pending" ON storage.objects;
CREATE POLICY "ticket_photos_select_anon_pending" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'ticket-photos' AND EXISTS (
      SELECT 1 FROM activities a
      WHERE a.action = 'Tiket dijeda'
        AND a.details IS NOT NULL
        AND a.details LIKE '%' || name || '%'
    )
  );

-- ── Self-check ──
DO $$
DECLARE
  v_tl json;
  v_code text;
  v_item jsonb;
  v_has_pending boolean := false;
  v_policy_exists boolean;
BEGIN
  IF NOT validate_transition('teknisi', 'EN_ROUTE', 'PENDING') THEN
    RAISE EXCEPTION 'FAIL: EN_ROUTE -> PENDING tidak diizinkan untuk teknisi';
  END IF;
  IF validate_transition('teknisi', 'WORKING', 'PENDING') THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'FAIL: WORKING -> PENDING harus tetap diizinkan';
  END IF;

  SELECT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'ticket_photos_select_anon_pending')
  INTO v_policy_exists;
  IF NOT v_policy_exists THEN
    RAISE EXCEPTION 'FAIL: policy ticket_photos_select_anon_pending tidak ada';
  END IF;

  SELECT code INTO v_code FROM tickets ORDER BY created_at DESC LIMIT 1;
  IF v_code IS NULL THEN
    RAISE NOTICE 'WARN: tidak ada tiket untuk uji get_public_timeline (skip)';
  ELSE
    SELECT get_public_timeline(v_code) INTO v_tl;
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_tl::jsonb) LOOP
      IF v_item->>'action' = 'Tiket dijeda' THEN
        v_has_pending := true;
      END IF;
      -- Details HANYA boleh berisi nilai pada baris pending; field internal lain tetap dilarang.
      IF (v_item->>'details' IS NOT NULL AND v_item->>'action' <> 'Tiket dijeda')
         OR v_item ? 'ticket_id' OR v_item ? 'user_id' THEN
        RAISE EXCEPTION 'FAIL: get_public_timeline membocorkan field internal';
      END IF;
    END LOOP;
    RAISE NOTICE 'PASS: timeline aman (% entri, pending=%s)', json_array_length(v_tl), v_has_pending;
  END IF;

  RAISE NOTICE 'PASS: validate_transition + storage policy pending OK';
END $$;
