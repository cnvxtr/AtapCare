-- ============================================================
-- 81: Binding pelanggan per-akun (Perusahaan / Site / Unit).
-- Pengganti "kode unik perusahaan" untuk laporan pelanggan:
-- admin membuat akun + memilih perusahaan/site/unit, lalu
-- create_public_ticket mengunci pelapor ke site/unit tsb.
-- Jalankan setelah 79_reporter_name_notif.sql (create_public_ticket).
-- ============================================================

-- ── 1. Kolom binding di users ────────────────────────────────
-- customer_id sudah ada (migrasi 45).
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES units(id) ON DELETE SET NULL;

-- ── 2. admin_save_user: terima binding ───────────────────────
-- DROP wajib: CREATE OR REPLACE dengan jumlah argumen beda akan
-- membuat overload (PostgREST: "function is not unique").
DROP FUNCTION IF EXISTS admin_save_user(uuid,text,text,text,text,text,text,text);

CREATE OR REPLACE FUNCTION admin_save_user(
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

  IF p_role = 'customer' AND
     (p_customer_id IS NULL OR p_site_id IS NULL OR p_unit_id IS NULL) THEN
    RETURN json_build_object('error',
      'Pelanggan wajib punya Perusahaan, Site, dan Unit.');
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

-- ── 3. create_public_ticket: kunci site/unit pelapor ────────
-- Badan disalin dari 79 (versi terakhir); signature identik →
-- CREATE OR REPLACE cukup, GRANT eksisting terbawa.
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
  v_user_site_id uuid;
  v_user_unit_id uuid;
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

  -- Pelanggan terautentikasi: wajib terkunci ke site & unit miliknya.
  IF v_caller IS NOT NULL THEN
    SELECT customer_id, site_id, unit_id
      INTO v_user_customer_id, v_user_site_id, v_user_unit_id
      FROM users WHERE id = v_caller;

    IF v_user_customer_id IS NOT NULL THEN
      IF v_user_site_id IS NULL OR v_user_unit_id IS NULL THEN
        RETURN json_build_object('error',
          'Akun Anda belum dikunci ke Site/Unit. Silakan hubungi admin.');
      END IF;

      IF NOT EXISTS (
            SELECT 1 FROM sites s
            WHERE s.id = v_user_site_id
              AND s.customer_id = v_user_customer_id
              AND s.is_deleted = false
              AND s.name = p_site
         )
         OR NOT EXISTS (
            SELECT 1 FROM units u
            WHERE u.id = v_user_unit_id
              AND u.site_id = v_user_site_id
              AND u.is_deleted = false
              AND u.name = p_unit
         ) THEN
        RETURN json_build_object('error',
          'Site/Unit tidak sesuai dengan penugasan akun Anda.');
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
    'Tiket ' || v_code || ' dari ' || p_site || ' (' || p_unit || ') oleh ' || p_reporter_name || ' menunggu validasi.');

  IF v_caller IS NOT NULL THEN
    PERFORM notify_user(v_caller, 'Tiket ' || v_code || ' diterima',
      'Tiket ' || v_code || ' berhasil dibuat dan menunggu validasi.');
  END IF;

  RETURN json_build_object('code', v_code);
END $$;

REVOKE EXECUTE ON FUNCTION create_public_ticket(text, text, text, text, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_public_ticket(text, text, text, text, text, text, text[]) TO anon, authenticated;

-- ── VERIFIKASI ringan ──
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'users' AND column_name IN ('site_id','unit_id')) AS binding_columns,
  pg_get_functiondef('admin_save_user(uuid,text,text,text,text,text,text,text,uuid,uuid,uuid)'::regprocedure)
    LIKE '%p_site_id%' AS admin_save_user_binding,
  pg_get_functiondef('create_public_ticket(text, text, text, text, text, text, text[])'::regprocedure)
    LIKE '%v_user_site_id%' AS create_public_ticket_locked;
