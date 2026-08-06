-- ============================================================
-- 20: Multi-teknisi / lead + support (K6).
-- Lead tetap assigned_to (perilaku lama tidak berubah). Support
-- = member tambahan di tabel ticket_assignments: boleh melihat
-- tiket, upload foto + catatan (add_team_note), TIDAK boleh
-- transisi status (BR 3.3.2: hanya Lead Engineer bisa Selesai).
-- Jalankan setelah 17 (notify_user) & 19 (update_ticket_status).
-- ============================================================

-- ── 1. Tabel penugasan ──
CREATE TABLE IF NOT EXISTS ticket_assignments (
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users(id),
  role     text NOT NULL DEFAULT 'teknisi' CHECK (role IN ('lead', 'teknisi')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_assignments_user ON ticket_assignments(user_id);

ALTER TABLE ticket_assignments ENABLE ROW LEVEL SECURITY;
-- SELECT untuk authenticated: dipakai subquery RLS tickets/activities
-- (member) dan frontend menanyakan penugasan miliknya. Write hanya RPC definer.
CREATE POLICY "ta_select_authenticated" ON ticket_assignments FOR SELECT TO authenticated USING (true);
REVOKE ALL ON ticket_assignments FROM anon, authenticated;

-- ── 2. assign_ticket: + p_support_ids uuid[] ──
-- Ganti overload lama (4 param) agar tidak bentrok; pemanggil named-arg
-- lama tetap kompatibel karena param baru punya DEFAULT.
DROP FUNCTION IF EXISTS assign_ticket(uuid, uuid, text, text);
CREATE OR REPLACE FUNCTION assign_ticket(
  p_ticket_id uuid, p_technician_id uuid, p_activity_action text DEFAULT NULL,
  p_activity_details text DEFAULT NULL, p_support_ids uuid[] DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_old_status text;
  v_new_status text;
  v_full_name text;
  v_code text;
  v_support uuid;
  v_names text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'pm' THEN
    RAISE EXCEPTION 'forbidden: assign is PM only';
  END IF;

  SELECT status, code INTO v_old_status, v_code FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  v_new_status := CASE WHEN p_technician_id IS NOT NULL THEN 'SCHEDULED' ELSE 'UNASSIGNED' END;
  IF NOT validate_transition(v_role, v_old_status, v_new_status) THEN
    RAISE EXCEPTION 'forbidden: pm cannot transition % -> %', v_old_status, v_new_status;
  END IF;

  UPDATE tickets SET assigned_to = p_technician_id, status = v_new_status, updated_at = now()
  WHERE id = p_ticket_id;

  -- Reset roster, isi ulang: lead + support (jika ada).
  DELETE FROM ticket_assignments WHERE ticket_id = p_ticket_id;
  IF p_technician_id IS NOT NULL THEN
    INSERT INTO ticket_assignments (ticket_id, user_id, role) VALUES (p_ticket_id, p_technician_id, 'lead');
    IF p_support_ids IS NOT NULL THEN
      FOREACH v_support IN ARRAY p_support_ids LOOP
        IF v_support IS DISTINCT FROM p_technician_id
           AND NOT EXISTS (SELECT 1 FROM ticket_assignments ta WHERE ta.ticket_id = p_ticket_id AND ta.user_id = v_support) THEN
          INSERT INTO ticket_assignments (ticket_id, user_id, role) VALUES (p_ticket_id, v_support, 'teknisi');
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Sertakan nama support di detail aktivitas (audit).
  IF p_support_ids IS NOT NULL THEN
    SELECT string_agg(full_name, ', ' ORDER BY full_name) INTO v_names
    FROM users WHERE id = ANY(p_support_ids) AND id IS DISTINCT FROM p_technician_id;
    IF v_names IS NOT NULL THEN
      p_activity_details := COALESCE(p_activity_details, '') || E'\nPendukung: ' || v_names;
    END IF;
  END IF;

  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;
  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
          COALESCE(p_activity_action,
                  CASE WHEN p_technician_id IS NOT NULL
                        THEN 'Tiket ditugaskan' ELSE 'Penugasan dibatalkan' END),
          p_activity_details);

  IF p_technician_id IS NOT NULL THEN
    PERFORM notify_user(p_technician_id,
      'Tugas baru: ' || v_code,
      'Tiket ' || v_code || ' ditugaskan kepada Anda.');
    IF p_support_ids IS NOT NULL THEN
      FOREACH v_support IN ARRAY p_support_ids LOOP
        IF v_support IS DISTINCT FROM p_technician_id THEN
          PERFORM notify_user(v_support,
            'Tugas pendukung: ' || v_code,
            'Anda ditugaskan sebagai pendukung tiket ' || v_code || '.');
        END IF;
      END LOOP;
    END IF;
  END IF;
END $$;

-- ── 3. add_team_note: foto + catatan oleh member (lead/support) & staff ──
CREATE OR REPLACE FUNCTION add_team_note(p_ticket_id uuid, p_details text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_member boolean;
  v_full_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS NULL THEN RAISE EXCEPTION 'forbidden: user has no role'; END IF;

  IF v_role IN ('admin', 'helpdesk', 'pm') THEN
    v_member := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = p_ticket_id AND (
        t.assigned_to = v_uid OR
        EXISTS (SELECT 1 FROM ticket_assignments ta WHERE ta.ticket_id = t.id AND ta.user_id = v_uid)
      )
    ) INTO v_member;
  END IF;
  IF NOT v_member THEN RAISE EXCEPTION 'forbidden: not a member of this ticket'; END IF;

  SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;
  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''), 'Catatan tambahan', p_details);
END $$;

-- ── 4. RLS: teknisi (lead ATAU support) bisa lihat tiket & aktivitasnya ──
DROP POLICY IF EXISTS "tickets_select_teknisi_assigned" ON tickets;
CREATE POLICY "tickets_select_teknisi_assigned" ON tickets FOR SELECT TO authenticated USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'teknisi' AND (
    assigned_to = auth.uid() OR
    EXISTS (SELECT 1 FROM ticket_assignments ta WHERE ta.ticket_id = tickets.id AND ta.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "activities_select_teknisi_assigned" ON activities;
CREATE POLICY "activities_select_teknisi_assigned" ON activities FOR SELECT TO authenticated USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'teknisi' AND EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.id = activities.ticket_id AND (
      t.assigned_to = auth.uid() OR
      EXISTS (SELECT 1 FROM ticket_assignments ta WHERE ta.ticket_id = t.id AND ta.user_id = auth.uid())
    )
  )
);

-- ── 5. Hak eksekusi ──
REVOKE EXECUTE ON FUNCTION assign_ticket(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION assign_ticket(uuid, uuid, text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION assign_ticket(uuid, uuid, text, text, uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION add_team_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION add_team_note(uuid, text) TO authenticated;
