-- ── 37. add_team_note + param aksi custom ──
-- Alur terima tugas 3 tahap: teknisi "menerima" tanpa pindah status (tetap SCHEDULED),
-- jadi perlu mencatat aktivitas "Tugas diterima" lewat add_team_note dengan aksi custom.
--
-- PENTING: DROP versi 2-arg (uuid, text) dulu. Kalau tidak, dua overload yang bisa
-- dipanggil dengan 2 argumen mengikuti default membuat fungsi ambigu — bug persis yang
-- pernah terjadi pada notify_role (migration 36).

DROP FUNCTION IF EXISTS add_team_note(uuid, text);

CREATE OR REPLACE FUNCTION add_team_note(p_ticket_id uuid, p_details text, p_action text DEFAULT 'Catatan tambahan')
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
  VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''), COALESCE(p_action, 'Catatan tambahan'), p_details);
END $$;

REVOKE EXECUTE ON FUNCTION add_team_note(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION add_team_note(uuid, text, text) TO authenticated;

-- Self-check: tepat 1 overload add_team_note (mencegah bug ambigu overload).
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'add_team_note';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'add_team_note harus tepat 1 overload, ada %', v_count;
  END IF;
END $$;
