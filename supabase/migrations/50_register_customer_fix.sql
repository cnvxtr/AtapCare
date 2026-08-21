-- Migration 50: Fix register_customer — pakai auth UUID dari frontend signUp.
-- Error sebelumnya: register_customer pakai gen_random_uuid() tapi users.id
-- punya FK ke auth.users(id) → FK violation karena UUID random tidak ada di auth.users.

CREATE OR REPLACE FUNCTION register_customer(
  p_name text,
  p_email text,
  p_phone text,
  p_user_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN json_build_object('error', 'Nama wajib diisi.');
  END IF;
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN json_build_object('error', 'Email wajib diisi.');
  END IF;
  IF p_user_id IS NULL THEN
    RETURN json_build_object('error', 'User ID wajib diisi.');
  END IF;

  -- Cek duplikat email
  IF EXISTS (SELECT 1 FROM users WHERE email = trim(p_email) AND is_deleted = false) THEN
    RETURN json_build_object('error', 'Email sudah terdaftar.');
  END IF;

  -- Insert ke tabel users pakai auth UUID (sudah ada di auth.users dari signUp)
  INSERT INTO users (id, email, username, name, full_name, wa_number, role, roles, status, is_deleted)
  VALUES (p_user_id, trim(p_email), trim(p_email), trim(p_name), trim(p_name), p_phone,
          'customer', 'customer', 'aktif', false);

  RETURN json_build_object('ok', true, 'user_id', p_user_id);
END $$;
