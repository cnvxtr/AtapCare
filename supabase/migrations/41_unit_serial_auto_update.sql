-- ============================================================
-- 41: Auto-sync serial unit ke master data saat tiket diselesaikan.
-- Teknisi mengisi "Serial Number (jika ada pergantian unit)" di form
-- Selesai → serial tersimpan di p_activity_details sebagai
-- "... | Serial Number: X | ...". Pada status RESOLVED, parse serial itu
-- lalu UPDATE units.serial_number untuk unit (site|unit) milik tiket.
-- Tidak ditemukan → skip + audit + notif helpdesk/pm.
-- Definisi kumulatif pola 17/19/31/35; body = migration 35 + blok baru.
-- ponytail: kecocokan unit lewat nama (site|unit), sama seperti reports.ts
-- & guard BR-75D; upgrade ke FK unit_id bila relasi aset dirapikan.
-- ============================================================

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
  v_serial text;
  v_unit_id uuid;
  v_site text;
  v_unit_name text;
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

  -- ── Auto-sync serial ke master data (migration 41) ──
  -- Hanya pada transisi nyata ke RESOLVED dengan Serial Number di details.
  IF p_new_status = 'RESOLVED' AND v_old_status <> 'RESOLVED'
     AND p_activity_details ILIKE '%Serial Number:%' THEN
    -- Regex sama persis dengan parsing laporan Riwayat Serial (reports.ts).
    v_serial := trim(substring(p_activity_details from 'Serial Number:\s*([^|]+)'));
    SELECT site, unit INTO v_site, v_unit_name FROM tickets WHERE id = p_ticket_id;
    SELECT u.id INTO v_unit_id
      FROM units u JOIN sites s ON s.id = u.site_id
     WHERE s.name = v_site AND u.name = v_unit_name
       AND u.is_deleted IS NOT TRUE AND s.is_deleted IS NOT TRUE;
    IF v_unit_id IS NULL THEN
      INSERT INTO audit_logs (actor_name, action, entity_type, metadata)
      VALUES (COALESCE(v_full_name, ''), 'auto_serial_skip', 'units',
              jsonb_build_object('ticket', v_code, 'serial', v_serial,
                                 'site', v_site, 'unit', v_unit_name,
                                 'reason', 'unit not found in master data'));
      PERFORM notify_role('helpdesk', 'Serial tidak sinkron: ' || v_code,
        'Unit ' || COALESCE(v_unit_name, '-') || ' di ' || COALESCE(v_site, '-') ||
        ' tidak ditemukan di master data — serial ' || v_serial ||
        ' TIDAK diperbarui otomatis. Perbaiki kecocokan site/unit lalu update manual.',
        p_ticket_id);
      PERFORM notify_role('pm', 'Serial tidak sinkron: ' || v_code,
        'Unit ' || COALESCE(v_unit_name, '-') || ' di ' || COALESCE(v_site, '-') ||
        ' tidak ditemukan di master data — serial ' || v_serial ||
        ' TIDAK diperbarui otomatis. Perbaiki kecocokan site/unit lalu update manual.',
        p_ticket_id);
    ELSE
      UPDATE units SET serial_number = v_serial, updated_at = now() WHERE id = v_unit_id;
      INSERT INTO audit_logs (actor_name, action, entity_type, entity_id, metadata)
      VALUES (COALESCE(v_full_name, ''), 'auto_serial_update', 'units', v_unit_id::text,
              jsonb_build_object('ticket', v_code, 'serial', v_serial,
                                 'site', v_site, 'unit', v_unit_name));
    END IF;
  END IF;
END $$;

-- ── Self-check: logika parse + match + update (migration 41) ──
-- RPC penuh butuh auth.uid() sehingga tak bisa diuji di migration;
-- yang diuji: regex parse serial, kecocokan site|unit, dan path not-found.
-- FK-bypass via session_replication_role (pola migration 34/35).
DO $$
DECLARE
  v_site uuid; v_unit uuid;
  v_serial text;
  v_rows int;
BEGIN
  SET LOCAL session_replication_role = replica;
  INSERT INTO sites (name, pic_name, pic_phone) VALUES ('Site SelfCheck 41', 'PIC', '081') RETURNING id INTO v_site;
  INSERT INTO units (site_id, name, serial_number) VALUES (v_site, 'Unit SelfCheck 41', 'OLD') RETURNING id INTO v_unit;

  v_serial := trim(substring('Selesai | Serial Number: NEW-SN-001 | Foto (1):a' from 'Serial Number:\s*([^|]+)'));
  ASSERT v_serial = 'NEW-SN-001', 'parse serial dari details gagal';

  UPDATE units u SET serial_number = v_serial
    FROM sites s WHERE s.id = u.site_id AND s.name = 'Site SelfCheck 41' AND u.name = 'Unit SelfCheck 41';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  ASSERT v_rows = 1, 'match site|unit harus tepat 1 baris';
  ASSERT (SELECT serial_number FROM units WHERE id = v_unit) = 'NEW-SN-001', 'serial tidak terupdate';

  UPDATE units SET name = 'Unit Lain' WHERE id = v_unit;
  UPDATE units u SET serial_number = 'X'
    FROM sites s WHERE s.id = u.site_id AND s.name = 'Site SelfCheck 41' AND u.name = 'Unit SelfCheck 41';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  ASSERT v_rows = 0, 'unit tak cocok harus 0 baris (skip path)';

  DELETE FROM units WHERE id = v_unit;
  DELETE FROM sites WHERE id = v_site;
  RESET session_replication_role;
END $$;
