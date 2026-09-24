-- ============================================================
-- Migration 54: Damai-kan trigger vs register_customer (konflik dua penulis profil)
--
-- Masalah: trigger on_auth_user_created membuat profil users begitu signUp sukses,
-- lalu register_customer melihat email itu "sudah ada" dan melempar error
-- "Email sudah terdaftar." padahal akun berhasil dibuat. Nomor HP juga hilang.
--
-- Solusi:
--   1. register_customer jadi upsert-ramah: profil buatan trigger DIPERKAYA
--      (name/full_name, wa_number, status, roles), bukan ditolak.
--   2. Trigger ikut mengisi status/roles/default_role secara eksplisit
--      (sebelumnya nyangkut default kolom DB: status='active', default_role='helpdesk').
--   3. Perbaikan data lama: samakan bahasa status & isi kolom yang kosong.
-- ============================================================

-- ── 1. register_customer versi upsert-ramah ────────────────────────────────
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

  -- Email dianggap duplikat hanya bila dipakai user LAIN
  IF EXISTS (SELECT 1 FROM users WHERE email = trim(p_email) AND id <> p_user_id AND is_deleted = false) THEN
    RETURN json_build_object('error', 'Email sudah terdaftar.');
  END IF;

  -- Profil sudah dibuat trigger saat signUp → cukup perkaya dari form
  IF EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    UPDATE users
       SET name       = trim(p_name),
           full_name  = trim(p_name),
           wa_number  = p_phone,
           status     = 'aktif',
           roles      = 'customer',
           updated_at = now()
     WHERE id = p_user_id;
    RETURN json_build_object('ok', true, 'user_id', p_user_id);
  END IF;

  -- Belum ada (jalur lama tanpa trigger) → insert seperti biasa
  INSERT INTO users (id, email, username, name, full_name, wa_number, role, roles, status, is_deleted)
  VALUES (p_user_id, trim(p_email), trim(p_email), trim(p_name), trim(p_name), p_phone,
          'customer', 'customer', 'aktif', false);

  RETURN json_build_object('ok', true, 'user_id', p_user_id);
END $$;
-- Catatan: CREATE OR REPLACE mempertahankan GRANT yang ada (anon, authenticated).

-- ── 2. Trigger diselaraskan (isi eksplisit, tidak lagi bergantung default kolom) ──
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, username, role, roles, status, default_role)
  VALUES (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    left(
      regexp_replace(
        coalesce(new.raw_user_meta_data->>'user_name', split_part(new.email, '@', 1)),
        '[^a-zA-Z0-9_]', '', 'g'
      ), 20
    ) || '_' || left(new.id::text, 6),
    'customer', 'customer', 'aktif', 'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ── 3. Perbaikan data lama ────────────────────────────────────────────────
UPDATE public.users SET status = 'aktif' WHERE status = 'active';
UPDATE public.users SET roles = 'customer' WHERE roles IS NULL AND role = 'customer';
UPDATE public.users SET default_role = 'customer' WHERE default_role = 'helpdesk';
ALTER TABLE public.users ALTER COLUMN default_role SET DEFAULT 'customer';

-- ── VERIFIKASI (aman dijalankan ulang) ────────────────────────────────────
SELECT email, username, full_name, wa_number, status, roles, default_role
FROM public.users ORDER BY created_at DESC LIMIT 5;
