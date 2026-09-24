-- ============================================================
-- ATAP CARE — Role jamak (multi-role) untuk Manajemen Pengguna.
-- Kolom `role` tetap = role aktif/utama (login, menu, RLS, RPC).
-- Kolom baru `roles` = seluruh role (comma-separated) untuk
-- display dan switch-role nanti.
-- Jalankan setelah 11_guest_master_data.sql.
--
-- PENTING: CREATE FUNCTION WAJIB sebelum REVOKE/GRANT yang
-- mereferensikan signature-nya. SQL Editor Supabase menjalankan
-- seluruh query dalam satu transaksi — REVOKE/GRANT di depan akan
-- menggagalkan migrasi dan me-rollback semuanya.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS roles text;

-- ── admin_save_user: terima daftar role penuh ──
-- Signature baru (8 param): p_id, p_email, p_username, p_name,
-- p_wa_number, p_role, p_status, p_roles.
CREATE OR REPLACE FUNCTION admin_save_user(
  p_id uuid,
  p_email text,
  p_username text,
  p_name text,
  p_wa_number text,
  p_role text,
  p_status text,
  p_roles text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_roles text := COALESCE(p_roles, p_role);
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM users WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RETURN json_build_object('error', 'Akses ditolak: hanya Admin');
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE id = p_id) THEN
    UPDATE users
    SET username = p_username, name = p_name, full_name = p_name,
        wa_number = p_wa_number, role = p_role, roles = v_roles, status = p_status,
        updated_at = now()
    WHERE id = p_id;
  ELSE
    INSERT INTO users (id, email, username, name, full_name, wa_number, role, roles, status, must_change_password, is_deleted)
    VALUES (p_id, p_email, p_username, p_name, p_name, p_wa_number, p_role, v_roles, p_status, true, false);
  END IF;

  RETURN json_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION admin_save_user(uuid,text,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_save_user(uuid,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_save_user(uuid,text,text,text,text,text,text,text) TO authenticated;
