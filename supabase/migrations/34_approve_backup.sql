-- ============================================================
-- 34: Persetujuan pengalihan (K8.1) + koreksi target notifikasi.
-- 1) Approval 1-klik PM: approve_backup / reject_backup / get_backup_request.
--    Status tiket TIDAK berubah (assign_ticket tak bisa dipakai: transisi
--    PM→SCHEDULED gagal untuk tiket EN_ROUTE/PENDING). Swap lead↔support
--    dilakukan manual, chain activity dipakai sebagai state.
-- 2) notify_role: hanya role AKTIF (kolom `role`), buang klausa multi-role
--    ANY(roles) — teknisi ber-role ganda tak lagi dapat notif role lain.
-- 3) notifications.ticket_id: agar notif bisa memicu aksi (tombol approve
--    inline di dropdown). read tetap via kolom read.
-- ============================================================

-- ── 1. Kolom ticket_id pada notifikasi ──
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL;

-- ── 2. notify_role: role aktif saja; overload 4-arg membawa ticket_id ──
CREATE OR REPLACE FUNCTION notify_role(
  p_role text, p_title text, p_message text, p_ticket_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO notifications (user_id, title, message, ticket_id)
  SELECT id, p_title, p_message, p_ticket_id FROM users
  WHERE is_deleted = false
    AND role = p_role;
$$;

-- 3-arg delegasi: kompatibel dengan seluruh pemanggil lama; grant yang sudah
-- direvoke (migration 17) tetap berlaku karena CREATE OR REPLACE mempertahankan.
CREATE OR REPLACE FUNCTION notify_role(p_role text, p_title text, p_message text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT notify_role(p_role, p_title, p_message, NULL);
$$;

REVOKE EXECUTE ON FUNCTION notify_role(text, text, text, uuid) FROM PUBLIC, anon;

-- ── 3. request_backup: sertakan ticket_id pada notif ──
CREATE OR REPLACE FUNCTION request_backup(p_ticket_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_member boolean;
  v_full_name text;
  v_code text;
  v_assignee text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'teknisi' THEN
    RAISE EXCEPTION 'forbidden: backup request is teknisi only';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM ticket_assignments ta
    WHERE ta.ticket_id = p_ticket_id AND ta.user_id = v_uid
  ) INTO v_member;
  IF NOT v_member THEN
    RAISE EXCEPTION 'forbidden: not a member of this ticket';
  END IF;

  SELECT t.code, u.full_name INTO v_code, v_assignee
  FROM tickets t LEFT JOIN users u ON u.id = t.assigned_to
  WHERE t.id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;

  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''), 'Pengalihan diminta',
          'Teknisi pendukung meminta pengalihan penanggung jawab.'
          || COALESCE(E'\nAlasan: ' || NULLIF(p_reason, ''), '')
          || COALESCE(E'\nPenanggung jawab saat ini: ' || v_assignee, ''));

  PERFORM notify_role('pm', 'Minta pengalihan: ' || v_code,
    'Teknisi pendukung ' || COALESCE(v_full_name, '-')
    || ' meminta pengalihan untuk tiket ' || v_code
    || '. Buka Command Center untuk menugaskan ulang.',
    p_ticket_id);
END $$;

-- ── 4. resolve_backup_request: chain activity sebagai state ──
-- Murni (tanpa auth), dipakai getter/approve/reject + self-check.
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
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT 1;
$$;

-- ── 5. get_backup_request: request yang masih menunggu (null jika tidak ada) ──
CREATE OR REPLACE FUNCTION get_backup_request(p_ticket_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_requester uuid;
  v_name text;
  v_requested_at timestamptz;
  v_action text;
  v_is_member boolean;
  v_is_lead boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'pm' THEN RAISE EXCEPTION 'forbidden: pm only'; END IF;

  SELECT requester_id, requester_name, requested_at, action
    INTO v_requester, v_name, v_requested_at, v_action
    FROM resolve_backup_request(p_ticket_id);

  IF v_action IS DISTINCT FROM 'Pengalihan diminta' THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM ticket_assignments ta
    WHERE ta.ticket_id = p_ticket_id AND ta.user_id = v_requester
  ), EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.id = p_ticket_id AND t.assigned_to = v_requester
  ) INTO v_is_member, v_is_lead;

  IF NOT COALESCE(v_is_member, false) OR COALESCE(v_is_lead, false) THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'requester_id', v_requester,
    'requester_name', v_name,
    'requested_at', v_requested_at
  );
END $$;

-- ── 6. approve_backup: swap lead↔support tanpa ubah status ──
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

  -- Swap: requester jadi lead, lead lama jadi pendukung. Status TIDAK berubah.
  UPDATE tickets SET assigned_to = v_requester, updated_at = now()
  WHERE id = p_ticket_id;
  DELETE FROM ticket_assignments WHERE ticket_id = p_ticket_id;
  INSERT INTO ticket_assignments (ticket_id, user_id, role)
  VALUES (p_ticket_id, v_requester, 'lead');
  IF v_lead IS NOT NULL AND v_lead IS DISTINCT FROM v_requester THEN
    INSERT INTO ticket_assignments (ticket_id, user_id, role)
    VALUES (p_ticket_id, v_lead, 'teknisi');
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

-- ── 7. reject_backup: tolak tanpa mengubah penugasan ──
CREATE OR REPLACE FUNCTION reject_backup(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_requester uuid;
  v_name text;
  v_code text;
  v_action text;
  v_actor_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'pm' THEN RAISE EXCEPTION 'forbidden: reject is PM only'; END IF;

  SELECT requester_id, action INTO v_requester, v_action
    FROM resolve_backup_request(p_ticket_id);
  IF v_action IS DISTINCT FROM 'Pengalihan diminta' THEN
    RAISE EXCEPTION 'no pending backup request';
  END IF;

  SELECT t.code INTO v_code FROM tickets t WHERE t.id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  SELECT full_name INTO v_name FROM users WHERE id = v_requester;
  SELECT full_name INTO v_actor_name FROM users WHERE id = v_uid;
  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_actor_name, ''),
          'Pengalihan ditolak',
          'Permintaan pengalihan oleh ' || COALESCE(v_name, 'teknisi') || ' ditolak PM.');

  PERFORM notify_user(v_requester, 'Pengalihan ditolak: ' || v_code,
    'Permintaan pengalihan penanggung jawab untuk tiket ' || v_code || ' ditolak PM.');
END $$;

-- ── 8. Hak eksekusi ──
REVOKE EXECUTE ON FUNCTION get_backup_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION approve_backup(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION reject_backup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_backup_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_backup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_backup(uuid) TO authenticated;

-- ── 9. Self-check: resolve chain activity (terbaru menang) ──
-- Data dummy memakai FK-bypass (session_replication_role) karena skema dasar
-- tickets/users dibuat di luar folder migration; bersih setelah assert.
DO $$
DECLARE
  v_tid uuid := gen_random_uuid();
  v_r record;
BEGIN
  SET LOCAL session_replication_role = replica;

  INSERT INTO activities (ticket_id, user_id, user_name, action, created_at)
  VALUES (v_tid, NULL, 'Chk One', 'Pengalihan diminta', now() - interval '2 minutes'),
         (v_tid, NULL, 'Chk Two', 'Pengalihan ditolak', now() - interval '1 minute');

  SELECT * INTO v_r FROM resolve_backup_request(v_tid);
  ASSERT v_r.action = 'Pengalihan ditolak', 'resolve: activity terbaru menang';
  ASSERT v_r.requester_id IS NULL, 'resolve: requester_id passthrough';

  INSERT INTO activities (ticket_id, user_id, user_name, action, created_at)
  VALUES (v_tid, NULL, 'Chk One', 'Pengalihan diminta', now());

  SELECT * INTO v_r FROM resolve_backup_request(v_tid);
  ASSERT v_r.action = 'Pengalihan diminta', 'resolve: setelah request baru lagi';

  -- Tiket tanpa chain → kosong (pending = null).
  SELECT * INTO v_r FROM resolve_backup_request(gen_random_uuid());
  ASSERT v_r.action IS NULL, 'resolve: tanpa activity';

  DELETE FROM activities WHERE ticket_id = v_tid;
  RESET session_replication_role;
END $$;
