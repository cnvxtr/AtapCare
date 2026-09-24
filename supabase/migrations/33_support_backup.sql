  -- ── 1. request_backup: teknisi pendukung minta pengalihan penanggung jawab ──
  -- Sinyal + audit saja; approval tetap lewat assign_ticket (PM-only, migration 20).
  -- Setelah PM reassign via Command Center, support otomatis jadi lead (v_own di
  -- update_ticket_status mengikuti assigned_to) — tidak ada guard status yang berubah.
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
      || '. Buka Command Center untuk menugaskan ulang.');
  END $$;

  REVOKE EXECUTE ON FUNCTION request_backup(uuid, text) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION request_backup(uuid, text) TO authenticated;
