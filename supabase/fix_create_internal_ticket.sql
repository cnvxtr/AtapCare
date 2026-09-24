-- Fix: create_internal_ticket — reorder params
-- Wajib dulu, opsional (DEFAULT NULL) di akhir.
-- PostgreSQL rule: setelah param DEFAULT, semua param setelahnya wajib juga DEFAULT.

-- 1. Drop versi lama (apapun param count-nya)
DROP FUNCTION IF EXISTS create_internal_ticket(text, text, text, text, text, text, text, text, text , text);
DROP FUNCTION IF EXISTS create_internal_ticket(text, text, text, text, text, text, text, text, text, text, text, text, text);

-- 2. Buat versi baru — wajib di depan, opsional di belakang
CREATE OR REPLACE FUNCTION create_internal_ticket(
  p_code text,
  p_customer text,
  p_company text,
  p_site text,
  p_unit text,
  p_status text,
  p_priority text,
  p_description text,
  p_activity_action text,
  p_activity_details text,
  p_category text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_photo_url text DEFAULT NULL
) RETURNS tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_row tickets;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF NOT validate_transition(v_role, NULL, p_status) THEN
    RAISE EXCEPTION 'forbidden: role % cannot create ticket', v_role;
  END IF;
  INSERT INTO tickets
    (code, customer, company, site, unit, status, priority, description, category, location, photo_url, created_by)
  VALUES
    (p_code, p_customer, p_company, p_site, p_unit, p_status, p_priority, p_description, p_category, p_location, p_photo_url, v_uid)
  RETURNING * INTO v_row;
  INSERT INTO activities (ticket_id, user_id, user_name, action, details)
  VALUES (v_row.id, v_uid, COALESCE((SELECT full_name FROM users WHERE id = v_uid), ''),
          p_activity_action, p_activity_details);
  RETURN v_row;
END $$;

-- 3. Revoke + grant
REVOKE EXECUTE ON FUNCTION create_internal_ticket(text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_internal_ticket(text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
