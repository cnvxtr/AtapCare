-- ============================================================
-- 91: Normalisasi switch_role (spasi/trim) agar semua role bisa dipilih.
-- ============================================================
CREATE OR REPLACE FUNCTION switch_role(p_role text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_roles text;
  v_prev text;
  v_name text;
  v_target text := trim(p_role);
  v_roles_norm text;
BEGIN
  SELECT roles, role, full_name INTO v_roles, v_prev, v_name FROM users WHERE id = v_uid;
  IF v_prev IS NULL THEN
    RETURN json_build_object('error', 'User tidak ditemukan');
  END IF;
  IF v_target = v_prev THEN
    RETURN json_build_object('ok', true, 'changed', false);
  END IF;
  v_roles_norm := replace(COALESCE(v_roles, ''), ' ', '');
  IF position(',' || v_target || ',' IN ',' || v_roles_norm || ',') = 0 THEN
    RETURN json_build_object('error', 'Role ' || v_target || ' tidak dimiliki user');
  END IF;
  UPDATE users SET role = v_target, updated_at = now() WHERE id = v_uid;
  INSERT INTO audit_logs (actor_name, action, entity_type, entity_id, metadata)
  VALUES (v_name, 'switch_role', 'users', v_uid,
          json_build_object('role_before', v_prev, 'role_after', v_target));
  RETURN json_build_object('ok', true, 'changed', true);
END $$;

REVOKE EXECUTE ON FUNCTION switch_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION switch_role(text) TO authenticated;