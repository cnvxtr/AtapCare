-- ============================================================
-- 35: Pendukung dengan request pengalihan boleh menyelesaikan tugas.
-- Pengalihan (K8.1) adalah sinyal "saya ambil alih tanggung jawab";
-- teknisi pendukung yang request-nya masih pending dapat RESOLVED
-- meski bukan assigned_to. Lead lama yang sudah diganti (kini support)
-- baru bisa selesaikan lagi setelah mengajukan pengalihan baru.
-- Guard lain (transisi status, prioritas) tetap lead-only (BR 3.3.2).
-- ============================================================

-- ── 1. can_teknisi_complete: predikat murni (tanpa auth) ──
-- true jika p_uid adalah lead, atau member pendukung (role='teknisi')
-- yang masih mengajukan pengalihan (chain terbaru = 'Pengalihan diminta').
CREATE OR REPLACE FUNCTION can_teknisi_complete(p_ticket_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = p_ticket_id AND t.assigned_to = p_uid
  ) OR EXISTS (
    SELECT 1 FROM resolve_backup_request(p_ticket_id) r
    JOIN ticket_assignments ta
      ON ta.ticket_id = p_ticket_id AND ta.user_id = p_uid AND ta.role = 'teknisi'
    WHERE r.requester_id = p_uid AND r.action = 'Pengalihan diminta'
  );
$$;

REVOKE EXECUTE ON FUNCTION can_teknisi_complete(uuid, uuid) FROM PUBLIC, anon;

-- ── 2. update_ticket_status: relax guard untuk RESOLVED ──
-- CREATE OR REPLACE mempertahankan GRANT eksisting (migration 31).
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
    -- Pendukung yang sudah mengajukan pengalihan boleh selesaikan tugas;
    -- transisi lain tetap hanya untuk lead.
    IF p_new_status <> 'RESOLVED' OR NOT can_teknisi_complete(p_ticket_id, v_uid) THEN
      RAISE EXCEPTION 'forbidden: teknisi can only act on own ticket';
    END IF;
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
  -- No-op guard: klik tanpa transisi status (mis. tombol prioritas P1/P2/P3
  -- yang memanggil OPEN->OPEN) tidak menulis entri timeline. UPDATE status/
  -- prioritas di atas tetap jalan, jadi prioritas tetap tersimpan.
  IF p_new_status <> v_old_status THEN
    INSERT INTO activities (ticket_id, user_id, user_name, action, details)
    VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
            COALESCE(p_activity_action, format('Status: %s -> %s', v_old_status, p_new_status)),
            p_activity_details);
  END IF;

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
END $$;

-- ── 3. Self-check: can_teknisi_complete ──
-- Branch lead trivial (SELECT EXISTS); yang diuji logika baru:
-- membership + chain request. FK-bypass karena skema dasar di luar
-- folder migration (pola migration 34).
DO $$
DECLARE
  v_tid uuid := gen_random_uuid();
  v_uid_sup uuid := gen_random_uuid();
  v_uid_out uuid := gen_random_uuid();
BEGIN
  SET LOCAL session_replication_role = replica;

  -- Non-member tanpa request → ditolak.
  ASSERT NOT can_teknisi_complete(v_tid, v_uid_out), 'non-member harus ditolak';

  -- Support mengajukan pengalihan → boleh selesaikan.
  INSERT INTO ticket_assignments (ticket_id, user_id, role)
  VALUES (v_tid, v_uid_sup, 'teknisi');
  INSERT INTO activities (ticket_id, user_id, user_name, action)
  VALUES (v_tid, v_uid_sup, 'Chk Sup', 'Pengalihan diminta');
  ASSERT can_teknisi_complete(v_tid, v_uid_sup), 'support dengan request pending harus bisa selesaikan';

  -- Ditolak → tidak boleh lagi.
  INSERT INTO activities (ticket_id, user_id, user_name, action)
  VALUES (v_tid, NULL, 'Chk PM', 'Pengalihan ditolak');
  ASSERT NOT can_teknisi_complete(v_tid, v_uid_sup), 'support setelah ditolak harus ditolak';

  -- Request dari yang sudah keluar dari tim → tidak boleh (anti-takedown).
  INSERT INTO activities (ticket_id, user_id, user_name, action)
  VALUES (v_tid, v_uid_out, 'Chk Out', 'Pengalihan diminta');
  INSERT INTO ticket_assignments (ticket_id, user_id, role)
  VALUES (v_tid, v_uid_out, 'teknisi');
  DELETE FROM ticket_assignments WHERE ticket_id = v_tid;
  ASSERT NOT can_teknisi_complete(v_tid, v_uid_out), 'request tanpa keanggotaan harus ditolak';

  DELETE FROM activities WHERE ticket_id = v_tid;
  DELETE FROM ticket_assignments WHERE ticket_id = v_tid;
  RESET session_replication_role;
END $$;

-- ── 4. Cleanup data lama: hapus entri timeline dari klik prioritas P1/P2/P3 ──
-- Tombol prioritas memanggil update_ticket_status(..., 'OPEN', 'Prioritas
-- ditetapkan: Px', ...) tanpa transisi status nyata. Sebelum no-op guard di
-- atas, tiap klik menulis 'Tiket divalidasi'. Signature-nya: details diawali
-- 'Prioritas ditetapkan:'. Entri validasi asli (details 'Konfirmasi via WA ke
-- pelapor') tidak tersentuh.
DELETE FROM activities
WHERE action IN ('Tiket divalidasi', 'Tiket divalidasi & dibuka')
  AND details LIKE 'Prioritas ditetapkan:%';

-- Normalisasi label riwayat lama: action yang masih bertuliskan
-- '& dibuka' diseragamkan menjadi 'Tiket divalidasi'.
UPDATE activities
SET action = 'Tiket divalidasi'
WHERE action = 'Tiket divalidasi & dibuka';
