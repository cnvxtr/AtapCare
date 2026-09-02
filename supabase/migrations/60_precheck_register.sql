-- ============================================================
-- 60. PRECHECK REGISTER (anti akun "yatim")
-- Validasi server-side SEBELUM supabase.auth.signUp() membuat
-- akun di auth.users. Dengan ini kegagalan validasi (username/
-- email/kode perusahaan) TIDAK meninggalkan akun Auth tanpa profil.
-- Dapat dijalankan ulang (idempotent).
-- ============================================================

CREATE OR REPLACE FUNCTION public.precheck_register(
  p_name text,
  p_email text,
  p_company_code text
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u text := lower(trim(coalesce(p_name, '')));
  v_customer_id uuid;
BEGIN
  IF u !~ '^[a-z0-9_]{3,20}$' THEN
    RETURN json_build_object('error',
      'Nama pengguna harus 3-20 karakter: huruf kecil, angka, underscore.');
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE lower(username) = u) THEN
    RETURN json_build_object('error',
      'Nama pengguna sudah dipakai. Coba tambahkan angka atau variasikan.');
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE email = trim(p_email) AND is_deleted = false) THEN
    RETURN json_build_object('error', 'Email sudah terdaftar.');
  END IF;

  IF p_company_code IS NOT NULL AND trim(p_company_code) <> '' THEN
    SELECT id INTO v_customer_id FROM customers
    WHERE lower(code) = lower(trim(p_company_code)) AND is_deleted = false
    LIMIT 1;
    IF v_customer_id IS NULL THEN
      RETURN json_build_object('error',
        'Kode unik perusahaan tidak ditemukan. Periksa kembali kode Anda.');
    END IF;
  END IF;

  RETURN json_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.precheck_register(text, text, text) TO anon, authenticated;
