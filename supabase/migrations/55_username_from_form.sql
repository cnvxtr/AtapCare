-- ============================================================
-- Migration 55: Nama Pengguna = username pilihan sendiri saat daftar
--
-- Model (disepakati pemilik sistem): form daftar punya SATU kolom identitas.
--   - Nilai kolom "Nama Pengguna" menjadi username (kunci login, WAJIB unik)
--   - full_name otomatis menyalinnya (nama tampilan; bisa diganti lewat Profil)
--
-- Perubahan:
--   1. register_customer (tanda tangan SAMA dengan migrasi 54, tanpa DROP):
--      normalisasi huruf kecil, validasi pola ^[a-z0-9_]{3,20}$, cek unik
--      dengan pesan ramah; jalur UPDATE maupun INSERT menyetel
--      username = full_name = nilai yang diketik.
--   2. Fungsi is_username_available() untuk indikator live di form
--      (SECURITY DEFINER karena RLS melarang anon membaca tabel users).
--   3. UNIQUE INDEX pada lower(username): jaring pengaman level database
--      untuk SEMUA jalur pembuatan akun (form customer, panel admin, trigger Google).
--      Konsekuensi yang disengaja: username milik user soft-delete terkunci
--      selamanya (tidak didaur ulang) — sederhana dan aman.
--
-- PRASYARAT: jalankan 54_register_upsert_fix.sql terlebih dahulu.
-- Cara: Supabase Dashboard → SQL Editor → paste → Run.
-- ============================================================

-- ── 1. register_customer versi username-pilihan-sendiri ──────────────────
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
DECLARE
  u text;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN json_build_object('error', 'Email wajib diisi.');
  END IF;
  IF p_user_id IS NULL THEN
    RETURN json_build_object('error', 'User ID wajib diisi.');
  END IF;

  -- Nama pengguna dinormalisasi: huruf kecil, tanpa spasi
  u := lower(trim(coalesce(p_name, '')));

  IF u !~ '^[a-z0-9_]{3,20}$' THEN
    RETURN json_build_object('error',
      'Nama pengguna harus 3-20 karakter: huruf kecil, angka, underscore.');
  END IF;

  -- Username dipakai orang lain? (termasuk user soft-delete: tidak didaur ulang)
  IF EXISTS (SELECT 1 FROM users WHERE lower(username) = u AND id <> p_user_id) THEN
    RETURN json_build_object('error',
      'Nama pengguna sudah dipakai. Coba tambahkan angka atau variasikan.');
  END IF;

  -- Email dianggap duplikat hanya bila dipakai user LAIN
  IF EXISTS (SELECT 1 FROM users WHERE email = trim(p_email) AND id <> p_user_id AND is_deleted = false) THEN
    RETURN json_build_object('error', 'Email sudah terdaftar.');
  END IF;

  -- Profil sudah dibuat trigger saat signUp → selaraskan identitasnya dengan form
  UPDATE users
     SET name       = u,
         full_name  = u,
         username   = u,
         wa_number  = p_phone,
         status     = 'aktif',
         roles      = 'customer',
         updated_at = now()
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    -- Jalur lama tanpa trigger → insert seperti biasa
    INSERT INTO users (id, email, username, name, full_name, wa_number, role, roles, status, is_deleted)
    VALUES (p_user_id, trim(p_email), u, u, u, p_phone,
            'customer', 'customer', 'aktif', false);
  END IF;

  RETURN json_build_object('ok', true, 'user_id', p_user_id);
END $$;
-- Catatan: CREATE OR REPLACE mempertahankan GRANT yang ada (anon, authenticated).

-- ── 2. Cek ketersediaan untuk indikator live di form daftar ──────────────
CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.users WHERE lower(username) = lower(trim(p_username))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

-- ── 3. Jaring pengaman: username unik di level database ──────────────────
-- Gagal dengan pesan jelas bila data lama masih mengandung duplikat.
DO $$
DECLARE d record;
BEGIN
  FOR d IN
    SELECT lower(username) AS uname, count(*) AS n
    FROM public.users
    GROUP BY 1 HAVING count(*) > 1
  LOOP
    RAISE EXCEPTION 'Duplikat username "%" (% baris) — bereskan dulu sebelum index unik.', d.uname, d.n;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key
  ON public.users (lower(username));

-- ── VERIFIKASI (aman dijalankan ulang) ───────────────────────────────────
SELECT email, username, full_name, wa_number, status, roles
FROM public.users ORDER BY created_at DESC LIMIT 5;
