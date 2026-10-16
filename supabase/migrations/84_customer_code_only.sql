-- ============================================================
-- 84: Akun pelanggan kembali berbasis KODE PERUSAHAAN saja.
--
-- Admin "Tambah Pelanggan" cukup isi kode unik perusahaan (kolom
-- customers.code) → users.customer_id terisi; site_id/unit_id
-- dibiarkan null. Pelanggan memilih Site & Unit sendiri saat
-- membuat tiket (daftar dibatasi ke milik perusahaannya).
--
-- Menyetel ulang dua fungsi yang migrasi 81 kunci ke Site/Unit:
--   1. admin_save_user   → pelanggan cukup punya customer_id.
--   2. create_public_ticket → cukup cek site milik perusahaan
--      (perilaku migrasi 59), tanpa kunci site_id/unit_id.
-- Jalankan setelah 83_lainnya_category_note.sql.
-- ============================================================

-- ── 1. admin_save_user: buang syarat Site/Unit ──────────────
-- DROP wajib: CREATE OR REPLACE dengan jumlah argumen beda bikin
-- overload (PostgREST: "function is not unique").
DROP FUNCTION IF EXISTS admin_save_user(uuid,text,text,text,text,text,text);           -- 7-arg legacy (03/05, cuma di-REVOKE di 12)
DROP FUNCTION IF EXISTS admin_save_user(uuid,text,text,text,text,text,text,text);       -- 8-arg (12)
DROP FUNCTION IF EXISTS admin_save_user(uuid,text,text,text,text,text,text,text,uuid,uuid,uuid); -- 11-arg (81)

CREATE FUNCTION admin_save_user(
  p_id uuid,
  p_email text,
  p_username text,
  p_name text,
  p_wa_number text,
  p_role text,
  p_status text,
  p_roles text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_site_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL
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

  -- Pelanggan cukup terhubung ke perusahaan (kode unik). Site/Unit
  -- opsional: dipilih pelanggan saat membuat tiket.
  IF p_role = 'customer' AND p_customer_id IS NULL THEN
    RETURN json_build_object('error',
      'Pelanggan wajib terhubung ke perusahaan (kode perusahaan).');
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE id = p_id) THEN
    UPDATE users
    SET username = p_username, name = p_name, full_name = p_name,
        wa_number = p_wa_number, role = p_role, roles = v_roles, status = p_status,
        customer_id = p_customer_id, site_id = p_site_id, unit_id = p_unit_id,
        updated_at = now()
    WHERE id = p_id;
  ELSE
    INSERT INTO users (id, email, username, name, full_name, wa_number, role, roles, status,
                       customer_id, site_id, unit_id, must_change_password, is_deleted)
    VALUES (p_id, p_email, p_username, p_name, p_name, p_wa_number, p_role, v_roles, p_status,
            p_customer_id, p_site_id, p_unit_id, true, false);
  END IF;

  RETURN json_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION admin_save_user(uuid,text,text,text,text,text,text,text,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_save_user(uuid,text,text,text,text,text,text,text,uuid,uuid,uuid) TO authenticated;

-- ── 2. create_public_ticket: cukup verifikasi site milik perusahaan ──
-- Badan = versi migrasi 59 (signature identik → GRANT eksisting terbawa).
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

  -- Customer terautentikasi: kunci ke perusahaannya sendiri.
  IF v_caller IS NOT NULL THEN
    SELECT customer_id INTO v_user_customer_id FROM users WHERE id = v_caller;

    IF v_user_customer_id IS NOT NULL THEN
      -- Site harus milik perusahaan akun (sites.customer_id), bukan mapping.
      IF NOT EXISTS (
        SELECT 1 FROM sites s
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
-- Self-check: cuma 1 overload admin_save_user, syarat Site/Unit hilang,
-- create_public_ticket kembali cek perusahaan (bukan kunci site/unit).
DO $$
DECLARE
  v_count integer;
  v_body text;
BEGIN
  SELECT count(*) INTO v_count FROM pg_proc WHERE proname = 'admin_save_user';
  ASSERT v_count = 1, format('FAIL: %s overload admin_save_user tersisa', v_count);

  SELECT prosrc INTO v_body FROM pg_proc WHERE proname = 'admin_save_user';
  ASSERT v_body NOT LIKE '%Site, dan Unit%', 'FAIL: syarat Site/Unit masih ada di admin_save_user';

  SELECT prosrc INTO v_body FROM pg_proc WHERE proname = 'create_public_ticket';
  ASSERT v_body LIKE '%Site tidak tersedia untuk akun Anda%', 'FAIL: cek company-scope hilang di create_public_ticket';
  ASSERT v_body NOT LIKE '%belum dikunci%', 'FAIL: kunci site/unit masih ada di create_public_ticket';
END $$;
