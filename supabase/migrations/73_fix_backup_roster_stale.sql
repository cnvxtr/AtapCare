-- ============================================================
-- 73: Perbaikan dua cacat alur teknisi pendukung.
--
-- 1) approve_backup membuang pendukung lain: temporary roster
--    (ticket_assignments) di-DELETE seluruhnya lalu ditulis ulang
--    hanya requester + lead lama. Akibatnya tiket ber-2+ pendukung
--    kehilangan anggota lain diam-diam. Fix: update per partisipan,
--    pendukung lain tetap utuh.
--
-- 2) Request pengalihan basi: resolve_backup_request hanya membaca
--    aksi chain ('Pengalihan diminta/ditolak/disetujui'). Bila PM
--    mengganti tim via assign_ticket (aksi 'Tiket ditugaskan' tidak
--    ada di filter), request lama masih terbaca pending. Fix: setiap
--    aksi penugasan ("Tiket ditugaskan%"/"Penugasan dibatalkan") yang
--    lebih baru dari request meniadakan status pending.
-- ============================================================

-- ── 1. approve_backup: swap lead⇄requester tanpa membuang pendukung lain ──
CREATE OR REPLACE FUNCTION approve_backup(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_requester uuid;
  v_name text;
  v_lead uuid;
  v_lead_name text;
  v_code text;
  v_action text;
  v_actor_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'pm' THEN RAISE EXCEPTION 'forbidden: approve is PM only'; END IF;

  SELECT requester_id, action INTO v_requester, v_action
    FROM resolve_backup_request(p_ticket_id);
  IF v_action IS DISTINCT FROM 'Pengalihan diminta' THEN
    RAISE EXCEPTION 'no pending backup request';
  END IF;

  SELECT t.assigned_to, u.full_name, t.code
    INTO v_lead, v_lead_name, v_code
    FROM tickets t LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  -- Guard anti double-approve & anti takedown: peminta masih member & belum lead.
  IF NOT EXISTS (
    SELECT 1 FROM ticket_assignments ta
    WHERE ta.ticket_id = p_ticket_id AND ta.user_id = v_requester
  ) OR v_requester = v_lead THEN
    RAISE EXCEPTION 'no pending backup request';
  END IF;

  -- Swap peran per partisipan; pendukung lain tetap di roster. Status TIDAK berubah.
  UPDATE tickets SET assigned_to = v_requester, updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO ticket_assignments (ticket_id, user_id, role)
  VALUES (p_ticket_id, v_requester, 'lead')
  ON CONFLICT (ticket_id, user_id) DO UPDATE SET role = 'lead';

  IF v_lead IS NOT NULL AND v_lead IS DISTINCT FROM v_requester THEN
    INSERT INTO ticket_assignments (ticket_id, user_id, role)
    VALUES (p_ticket_id, v_lead, 'teknisi')
    ON CONFLICT (ticket_id, user_id) DO UPDATE SET role = 'teknisi';
  END IF;

  SELECT full_name INTO v_name FROM users WHERE id = v_requester;
  SELECT full_name INTO v_actor_name FROM users WHERE id = v_uid;
  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_actor_name, ''),
          'Pengalihan disetujui',
          'Penanggung jawab dialihkan ke ' || COALESCE(v_name, 'teknisi')
          || COALESCE(' (sebelumnya ' || v_lead_name || ')', ''));

  PERFORM notify_user(v_requester, 'Pengalihan disetujui: ' || v_code,
    'Permintaan pengalihan penanggung jawab untuk tiket ' || v_code || ' disetujui.');
  IF v_lead IS NOT NULL AND v_lead IS DISTINCT FROM v_requester THEN
    PERFORM notify_user(v_lead, 'Tugas pendukung: ' || v_code,
      'Anda kini menjadi pendukung tiket ' || v_code || '.');
  END IF;
END $$;

-- ── 2. resolve_backup_request: aksi penugasan yang lebih baru meniadakan pending ──
CREATE OR REPLACE FUNCTION resolve_backup_request(p_ticket_id uuid)
RETURNS TABLE (requester_id uuid, requester_name text, requested_at timestamptz, action text)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT a.user_id, COALESCE(u.full_name, ''), a.created_at, a.action
  FROM activities a
  LEFT JOIN users u ON u.id = a.user_id
  WHERE a.ticket_id = p_ticket_id
    AND a.action IN ('Pengalihan diminta', 'Pengalihan ditolak', 'Pengalihan disetujui')
    AND NOT EXISTS (
      SELECT 1 FROM activities a2
      WHERE a2.ticket_id = p_ticket_id
        AND (a2.action LIKE 'Tiket ditugaskan%' OR a2.action = 'Penugasan dibatalkan')
        AND a2.created_at > a.created_at
    )
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT 1;
$$;

-- ── 3. Self-check: supersede & pelestarian (pola migration 34) ──
-- Data dummy memakai FK-bypass (session_replication_role); bersih setelah assert.
DO $$
DECLARE
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();
  v_r record;
BEGIN
  SET LOCAL session_replication_role = replica;

  -- A: request lalu PM reassign → tidak lagi pending.
  INSERT INTO activities (ticket_id, user_id, user_name, action, created_at)
  VALUES (v_a, NULL, 'Chk Sup', 'Pengalihan diminta', now() - interval '5 minutes'),
         (v_a, NULL, 'Chk PM', 'Tiket ditugaskan ke Teknisi Baru', now() - interval '1 minute');
  SELECT * INTO v_r FROM resolve_backup_request(v_a);
  ASSERT v_r.action IS DISTINCT FROM 'Pengalihan diminta', 'reassign harus membatalkan pending';

  -- B: catatan tambahan TIDAK membatalkan pending.
  INSERT INTO activities (ticket_id, user_id, user_name, action, created_at)
  VALUES (v_b, NULL, 'Chk Sup', 'Pengalihan diminta', now() - interval '2 minutes'),
         (v_b, NULL, 'Chk Sup', 'Catatan tambahan', now() - interval '1 minute');
  SELECT * INTO v_r FROM resolve_backup_request(v_b);
  ASSERT v_r.action = 'Pengalihan diminta', 'catatan tambahan tidak membatalkan pending';

  -- C: ditolak lebih baru → ditolak menang, walau ada request lebih lama.
  INSERT INTO activities (ticket_id, user_id, user_name, action, created_at)
  VALUES (v_c, NULL, 'Chk Sup', 'Pengalihan diminta', now() - interval '2 minutes'),
         (v_c, NULL, 'Chk PM', 'Pengalihan ditolak', now() - interval '1 minute');
  SELECT * INTO v_r FROM resolve_backup_request(v_c);
  ASSERT v_r.action = 'Pengalihan ditolak', 'tindakan PM terakhir menang';

  DELETE FROM activities WHERE ticket_id IN (v_a, v_b, v_c);
  RESET session_replication_role;
END $$;