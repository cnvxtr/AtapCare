-- ============================================================
-- 63: Ubah istilah activity "Kategori / akar masalah diperbarui"
-- menjadi "Temuan awal / akhir diperbarui" agar konsisten dengan
-- label UI (temuan awal = kategori, temuan akhir = akar kendala).
-- Fungsi set_ticket_catalog di-recreate dengan hanya perubahan
-- string action; logika/param/RPC tidak berubah.
-- ============================================================

CREATE OR REPLACE FUNCTION set_ticket_catalog(
  p_ticket_id uuid, p_category_id uuid DEFAULT NULL,
  p_root_cause_id uuid DEFAULT NULL, p_root_cause_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_code text;
  v_full_name text;
  v_category_name text;
  v_root_name text;
  v_parts text[] := '{}';
  v_old_category_id uuid;
  v_old_root_id uuid;
  v_old_root_note text;
  v_changed boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS NULL THEN RAISE EXCEPTION 'forbidden: user has no role'; END IF;

  IF v_role = 'teknisi' THEN
    IF p_category_id IS NOT NULL THEN
      RAISE EXCEPTION 'forbidden: teknisi cannot set category';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = p_ticket_id AND (
        t.assigned_to = v_uid OR
        EXISTS (SELECT 1 FROM ticket_assignments ta
                WHERE ta.ticket_id = t.id AND ta.user_id = v_uid)
      )
    ) THEN
      RAISE EXCEPTION 'forbidden: not a member of this ticket';
    END IF;
  ELSIF v_role NOT IN ('admin', 'helpdesk', 'pm') THEN
    RAISE EXCEPTION 'forbidden: no catalog permission';
  END IF;

  SELECT code, category_id, root_cause_id, root_cause_note
    INTO v_code, v_old_category_id, v_old_root_id, v_old_root_note
  FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  v_changed := (p_category_id IS NOT NULL AND p_category_id IS DISTINCT FROM v_old_category_id)
            OR (p_root_cause_id IS NOT NULL AND p_root_cause_id IS DISTINCT FROM v_old_root_id)
            OR (p_root_cause_note IS NOT NULL AND p_root_cause_note IS DISTINCT FROM v_old_root_note);

  IF v_changed THEN
    UPDATE tickets SET
      category_id = COALESCE(p_category_id, category_id),
      root_cause_id = COALESCE(p_root_cause_id, root_cause_id),
      root_cause_note = COALESCE(p_root_cause_note, root_cause_note),
      updated_at = now()
    WHERE id = p_ticket_id;

    IF p_category_id IS NOT NULL THEN
      SELECT name INTO v_category_name FROM problem_categories WHERE id = p_category_id;
      v_parts := v_parts || ('Kategori: ' || COALESCE(v_category_name, '?'));
    END IF;
    IF p_root_cause_id IS NOT NULL THEN
      SELECT name INTO v_root_name FROM root_causes WHERE id = p_root_cause_id;
      v_parts := v_parts || ('Akar masalah: ' || COALESCE(v_root_name, '?'));
    END IF;
    IF p_root_cause_note IS NOT NULL THEN
      v_parts := v_parts || ('Catatan: ' || p_root_cause_note);
    END IF;

    SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;
    INSERT INTO activities (ticket_id, user_id, user_name, action, details)
    VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
            'Temuan awal / akhir diperbarui',
            CASE WHEN cardinality(v_parts) > 0 THEN array_to_string(v_parts, E'\n') ELSE NULL END);
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION set_ticket_catalog(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_ticket_catalog(uuid, uuid, uuid, text) TO authenticated;

-- Self-check: action baru dipakai, action lama tidak.
DO $$
DECLARE
  v_body text;
BEGIN
  SELECT prosrc INTO v_body FROM pg_proc WHERE proname = 'set_ticket_catalog';
  ASSERT v_body LIKE '%Temuan awal / akhir diperbarui%', 'FAIL: action baru tidak ditemukan';
  ASSERT v_body NOT LIKE '%Kategori / akar masalah diperbarui%', 'FAIL: action lama masih ada';
END $$;