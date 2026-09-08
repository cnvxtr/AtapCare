-- ============================================================
-- Migration 59: Kode Unik Perusahaan untuk alur customer.
--
-- Tujuan: fungsi kode unik perusahaan tersimpan di users.customer_id
--   → daftar hanya sekali (form registrasi), lalu semua site/unit
--   milik perusahaan itu terbuka. Tidak dipakai saat login.
--
-- Perubahan:
--   1. UNIQUE INDEX pada customers.code (jaring pengaman; sebelumnya
--      belum ada constraint, padahal dipakai sebagai kunci masuk).
--   2. register_customer menerima p_company_code (opsional, karena
--      akun lama/role lain tidak punya) → validasi terhadap
--      customers.code (is_deleted=false), simpan users.customer_id.
--   3. create_public_ticket: bila pemanggil adalah customer yang
--      sudah punya customer_id, (a) validasi site benar milik
--      perusahaannya (sites.customer_id = users.customer_id, BUKAN
--      customer_sites_mapping), dan (b) isi kolom company dengan
--      customers.name (perbaiki bug: sebelumnya company= nama site).
--      Portal guest (anon) tetap berfungsi seperti biasa.
-- ============================================================

-- ── 1. Kode unik perusahaan (jaring pengaman) ────────────────
-- Gagal dengan pesan jelas bila ada kode duplikat pada data lama.
DO $$
DECLARE d record;
BEGIN
  FOR d IN
    SELECT code, count(*) AS n
    FROM public.customers
    WHERE code IS NOT NULL AND trim(code) <> ''
    GROUP BY code HAVING count(*) > 1
  LOOP
    RAISE EXCEPTION 'Kode perusahaan "%" duplikat (% baris) — bereskan dulu.', d.code, d.n;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS customers_code_unique_key
  ON public.customers (lower(code))
  WHERE code IS NOT NULL AND trim(code) <> '';

-- ── 2. register_customer: terima kode unik perusahaan ─────────
CREATE OR REPLACE FUNCTION register_customer(
  p_name text,
  p_email text,
  p_phone text,
  p_user_id uuid,
  p_company_code text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u text;
  v_customer_id uuid;
BEGIN
  -- Izinkan fungsi SECURITY DEFINER tepercaya melewati RLS tabel users
  -- hanya di dalam fungsi ini (berakhir otomatis saat fungsi selesai).
  -- RLS untuk akses langsung frontend tetap aktif penuh.
  SET LOCAL row_security = off;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN json_build_object('error', 'Email wajib diisi.');
  END IF;
  IF p_user_id IS NULL THEN
    RETURN json_build_object('error', 'User ID wajib diisi.');
  END IF;

  u := lower(trim(coalesce(p_name, '')));

  IF u !~ '^[a-z0-9_]{3,20}$' THEN
    RETURN json_build_object('error',
      'Nama pengguna harus 3-20 karakter: huruf kecil, angka, underscore.');
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE lower(username) = u AND id <> p_user_id) THEN
    RETURN json_build_object('error',
      'Nama pengguna sudah dipakai. Coba tambahkan angka atau variasikan.');
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE email = trim(p_email) AND id <> p_user_id AND is_deleted = false) THEN
    RETURN json_build_object('error', 'Email sudah terdaftar.');
  END IF;

  -- Kode unik perusahaan (diisi customer saat daftar)
  IF p_company_code IS NOT NULL AND trim(p_company_code) <> '' THEN
    SELECT id INTO v_customer_id FROM customers
    WHERE lower(code) = lower(trim(p_company_code)) AND is_deleted = false
    LIMIT 1;
    IF v_customer_id IS NULL THEN
      RETURN json_build_object('error',
        'Kode unik perusahaan tidak ditemukan. Periksa kembali kode Anda.');
    END IF;
  END IF;

  UPDATE users
     SET name       = u,
         full_name  = u,
         username   = u,
         wa_number  = p_phone,
         status     = 'aktif',
         roles      = 'customer',
         customer_id = coalesce(v_customer_id, customer_id),
         updated_at = now()
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO users (id, email, username, name, full_name, wa_number, role, roles, status, customer_id, is_deleted)
    VALUES (p_user_id, trim(p_email), u, u, u, p_phone,
            'customer', 'customer', 'aktif', v_customer_id, false);
  END IF;

  RETURN json_build_object('ok', true, 'user_id', p_user_id);
END $$;

GRANT EXECUTE ON FUNCTION public.register_customer(text, text, text, uuid, text) TO anon, authenticated;
-- Pertahankan overload lama ber-4 argumen (DEFAULT) untuk akun yang belum dideploy.
GRANT EXECUTE ON FUNCTION public.register_customer(text, text, text, uuid) TO anon, authenticated;

-- ── 3. create_public_ticket: verifikasi + company = nama perusahaan ──
CREATE OR REPLACE FUNCTION create_public_ticket(
  p_reporter_name text,
  p_position text,
  p_phone text,
  p_site text,
  p_unit text,
  p_description text,
  p_photos text[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_id uuid;
  v_count int;
  v_caller uuid := auth.uid();
  v_user_customer_id uuid;
  v_company_name text;
  i int;
  j int;
BEGIN
  -- Izinkan fungsi SECURITY DEFINER tepercaya membaca users.customer_id
  -- untuk verifikasi site milik perusahaan akun (RLS frontend tetap aktif).
  SET LOCAL row_security = off;

  IF p_reporter_name IS NULL OR trim(p_reporter_name) = '' OR
     p_site IS NULL OR trim(p_site) = '' OR
     p_unit IS NULL OR trim(p_unit) = '' OR
     p_description IS NULL OR trim(p_description) = '' THEN
    RETURN json_build_object('error', 'Semua field wajib diisi.');
  END IF;

  -- Rate limit
  IF p_phone IS NOT NULL AND trim(p_phone) <> '' THEN
    INSERT INTO rate_limits (key, window_start, count)
    VALUES ('phone:' || trim(p_phone), now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - interval '600 seconds'
                   THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - interval '600 seconds'
                          THEN now() ELSE rate_limits.window_start END
    RETURNING count INTO v_count;

    IF v_count > 3 THEN
      RETURN json_build_object('error', 'Terlalu banyak laporan dalam 10 menit. Silakan coba lagi nanti.');
    END IF;
  END IF;

  -- Customer terautentikasi: kunci ke perusahaannya sendiri
  IF v_caller IS NOT NULL THEN
    SELECT customer_id INTO v_user_customer_id FROM users WHERE id = v_caller;

    IF v_user_customer_id IS NOT NULL THEN
      -- Verifikasi site milik perusahaan akun (sites.customer_id),
      -- bukan customer_sites_mapping.
      IF NOT EXISTS (
        SELECT 1 FROM sites s
        JOIN customers c ON c.id = s.customer_id
        WHERE s.customer_id = v_user_customer_id
          AND s.is_deleted = false
          AND s.name = p_site
      ) THEN
        RETURN json_build_object('error', 'Site tidak tersedia untuk akun Anda.');
      END IF;

      SELECT name INTO v_company_name FROM customers WHERE id = v_user_customer_id;
    END IF;
  END IF;

  FOR i IN 1..10 LOOP
    v_code := 'ATC-' || to_char(now(), 'YYYYMMDD') || '-';
    FOR j IN 1..4 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM tickets WHERE code = v_code);
  END LOOP;

  BEGIN
    -- company = nama perusahaan akun (bila customer), bukan nama site.
    INSERT INTO tickets (code, customer, company, site, unit, location, category, description, status, priority, created_by, created_by_user_id)
    VALUES (v_code, p_reporter_name,
            coalesce(v_company_name, p_site),
            p_site, p_unit, p_site, p_unit,
            'Jabatan: ' || coalesce(p_position, '') || E'\nWA Pelapor: ' || coalesce(p_phone, '') || E'\n\n' || p_description,
            'NEW', NULL, NULL, v_caller)
    RETURNING id INTO v_id;
  EXCEPTION WHEN foreign_key_violation THEN
    RETURN json_build_object('error', 'Site atau Unit belum terdaftar di sistem. Silakan hubungi Helpdesk via WhatsApp Group.');
  END;

  INSERT INTO activities (ticket_id, user_id, user_name, action)
  VALUES (v_id, NULL, p_reporter_name, 'Tiket dibuat dengan status Baru');

  IF p_photos IS NOT NULL AND cardinality(p_photos) > 0 THEN
    INSERT INTO activities (ticket_id, user_id, user_name, action, details)
    VALUES (v_id, NULL, p_reporter_name, 'Foto keluhan (' || cardinality(p_photos) || ')',
            'Foto keluhan:' || E'\n' || array_to_string(p_photos, E'\n'));
  END IF;

  PERFORM notify_role('helpdesk', 'Tiket baru: ' || v_code,
    'Tiket ' || v_code || ' dari ' || p_site || ' (' || p_unit || ') menunggu validasi.');

  IF v_caller IS NOT NULL THEN
    PERFORM notify_user(v_caller, 'Tiket ' || v_code || ' diterima',
      'Tiket ' || v_code || ' berhasil dibuat dan menunggu validasi.');
  END IF;

  RETURN json_build_object('code', v_code);
END $$;

-- ── VERIFIKASI ───────────────────────────────────────────────
SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'customer_id';
SELECT indexname FROM pg_indexes WHERE indexname = 'customers_code_unique_key';
