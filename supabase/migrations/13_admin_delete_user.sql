-- ============================================================
-- ATAP CARE — Soft-delete user (Manajemen Pengguna).
-- Hapus akun = tandai is_deleted=true + status nonaktif (bukan
-- hapus fisik). Guard: hanya Admin, bukan akun sendiri, dan user
-- yang masih memegang tiket aktif tidak bisa dihapus (konsisten
-- dengan aturan status Nonaktif & guard Master Data BR-75D).
-- Jalankan setelah 12_user_roles.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION admin_delete_user(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_active integer;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM users WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RETURN json_build_object('error', 'Akses ditolak: hanya Admin');
  END IF;

  IF p_id = auth.uid() THEN
    RETURN json_build_object('error', 'Tidak bisa menghapus akun sendiri');
  END IF;

  SELECT count(*) INTO v_active
  FROM tickets
  WHERE assigned_to = p_id
    AND status IN ('NEW', 'OPEN', 'UNASSIGNED', 'SCHEDULED', 'EN_ROUTE', 'WORKING', 'PENDING');

  IF v_active > 0 THEN
    RETURN json_build_object(
      'error', format('User masih memegang %s tiket aktif. Harap ganti penugasan tiket terlebih dahulu.', v_active)
    );
  END IF;

  UPDATE users
  SET is_deleted = true, status = 'nonaktif', updated_at = now()
  WHERE id = p_id;

  INSERT INTO audit_logs (actor_name, action, entity_type, entity_id, metadata)
  VALUES ('Admin', 'delete_user', 'users', p_id, json_build_object('deleted_by', auth.uid()));

  RETURN json_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_delete_user(uuid) TO authenticated;
