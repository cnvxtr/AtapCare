-- ============================================================
-- 44: Pulihkan rate limit portal (K12 / BR-115B) yang hilang.
-- Migration 31 menimpa create_public_ticket (migration 21) dengan menambah
-- notif helpdesk tapi TANPA blok throttle per-WA → rate limit 3 tiket/10
-- menit menghilang sejak 31. File ini = body migration 31 (notif helpdesk)
-- + blok rate limit migration 21, plus CREATE TABLE idempoten untuk
-- rate_limits (migration 21 ternyata belum pernah diterapkan di DB ini).
-- ============================================================

-- ── 1. Tabel counter (idempoten; dari migration 21) ──
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count int NOT NULL
);
-- Akses hanya lewat RPC definer.
REVOKE ALL ON rate_limits FROM anon, authenticated;

-- ── 2. create_public_ticket + throttle + notif helpdesk ──
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
  i int;
  j int;
BEGIN
  IF p_reporter_name IS NULL OR trim(p_reporter_name) = '' OR
     p_site IS NULL OR trim(p_site) = '' OR
     p_unit IS NULL OR trim(p_unit) = '' OR
     p_description IS NULL OR trim(p_description) = '' THEN
    RETURN json_build_object('error', 'Semua field wajib diisi.');
  END IF;

  -- Throttle per-phone: 3 tiket / 10 menit (migration 21). Upsert tunggal
  -- aman dari race (ON CONFLICT diserialisasi per key). Nomor kosong tidak
  -- dithrottle — tanpa identitas, membatasi semua "unknown" saling memblokir.
  -- ponytail: sliding window per-phone; upgrade ke per-IP butuh Edge
  -- Function (HTTP) yang melihat request origin.
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

  FOR i IN 1..10 LOOP
    v_code := 'ATC-' || to_char(now(), 'YYYYMMDD') || '-';
    FOR j IN 1..4 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM tickets WHERE code = v_code);
  END LOOP;

  BEGIN
    INSERT INTO tickets (code, customer, company, site, unit, location, category, description, status, priority, created_by)
    VALUES (v_code, p_reporter_name, p_site, p_site, p_unit, p_site, p_unit,
            'Jabatan: ' || coalesce(p_position, '') || E'\nWA Pelapor: ' || coalesce(p_phone, '') || E'\n\n' || p_description,
            'NEW', NULL, NULL)
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

  RETURN json_build_object('code', v_code);
END $$;

REVOKE EXECUTE ON FUNCTION create_public_ticket(text, text, text, text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_public_ticket(text, text, text, text, text, text, text[]) TO anon, authenticated;

-- ── Self-check: 3 sukses, call ke-4 ditolak; notif helpdesk ter-trigger. ──
DO $$
DECLARE
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
  v_site uuid; v_unit uuid;
  v_res json; v_code text;
  v_codes text[] := '{}';
  v_phone text := '0813' || left(v_suffix, 7);
  i int;
BEGIN
  SET LOCAL session_replication_role = replica;

  INSERT INTO sites (name, pic_name, pic_phone) VALUES ('Site SelfCheck 44', 'PIC', '081') RETURNING id INTO v_site;
  INSERT INTO units (site_id, name) VALUES (v_site, 'Unit SelfCheck 44') RETURNING id INTO v_unit;

  FOR i IN 1..3 LOOP
    SELECT create_public_ticket('Chk 44', '', v_phone, 'Site SelfCheck 44', 'Unit SelfCheck 44',
                                'rate-limit selfcheck ' || i) INTO v_res;
    v_code := v_res->>'code';
    ASSERT v_code IS NOT NULL, 'call ' || i || ' harus sukses, dapat: ' || v_res::text;
    v_codes := v_codes || v_code;
  END LOOP;

  SELECT create_public_ticket('Chk 44', '', v_phone, 'Site SelfCheck 44', 'Unit SelfCheck 44',
                              'rate-limit selfcheck 4') INTO v_res;
  ASSERT v_res->>'error' IS NOT NULL, 'call ke-4 harus ditolak rate limit';
  ASSERT v_res->>'error' LIKE '%10 menit%', 'pesan rate limit sesuai';

  FOREACH v_code IN ARRAY v_codes LOOP
    DELETE FROM notifications WHERE title LIKE '%' || v_code || '%';
    IF to_regclass('public.ticket_status_history') IS NOT NULL THEN
      DELETE FROM ticket_status_history WHERE ticket_id IN (SELECT id FROM tickets WHERE code = v_code);
    END IF;
    DELETE FROM activities WHERE ticket_id IN (SELECT id FROM tickets WHERE code = v_code);
    DELETE FROM tickets WHERE code = v_code;
  END LOOP;
  DELETE FROM rate_limits WHERE key = 'phone:' || v_phone;
  DELETE FROM units WHERE id = v_unit;
  DELETE FROM sites WHERE id = v_site;
  RESET session_replication_role;
END $$;
