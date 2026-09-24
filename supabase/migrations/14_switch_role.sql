-- ============================================================
-- ATAP CARE — Switch Role.
-- Pindah role aktif = update kolom `role` user ke role tujuan,
-- hanya jika role tujuan ada di kolom `roles` miliknya.
-- Aktivitas tercatat di audit_logs (role_before/role_after).
-- Jalankan setelah 12_user_roles.sql (kolom `roles`).
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
BEGIN
  SELECT roles, role, full_name INTO v_roles, v_prev, v_name FROM users WHERE id = v_uid;
  IF v_prev IS NULL THEN
    RETURN json_build_object('error', 'User tidak ditemukan');
  END IF;
  IF p_role = v_prev THEN
    RETURN json_build_object('ok', true, 'changed', false);
  END IF;
  IF position(',' || p_role || ',' IN ',' || v_roles || ',') = 0 THEN
    RETURN json_build_object('error', 'Role ' || p_role || ' tidak dimiliki user');
  END IF;
  UPDATE users SET role = p_role, updated_at = now() WHERE id = v_uid;
  INSERT INTO audit_logs (actor_name, action, entity_type, entity_id, metadata)
  VALUES (v_name, 'switch_role', 'users', v_uid,
          json_build_object('role_before', v_prev, 'role_after', p_role));
  RETURN json_build_object('ok', true, 'changed', true);
END $$;

REVOKE EXECUTE ON FUNCTION switch_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION switch_role(text) TO authenticated;
