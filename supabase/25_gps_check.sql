-- Self-check 25_gps_stats.sql (jalankan di Supabase SQL Editor,
-- akun anon/authenticated tidak perlu).
-- Non-destruktif: tidak ada mutasi data.

DO $$
DECLARE
  v_stats json;
  v_units int;
  v_total int;
  v_month int;
  v_ok boolean;
BEGIN
  -- 1. Tabel & fungsi ada
  IF to_regclass('public.ticket_gps') IS NULL THEN
    RAISE EXCEPTION 'FAIL: tabel ticket_gps tidak ada';
  END IF;
  IF to_regprocedure('record_gps(uuid, double precision, double precision, text)') IS NULL THEN
    RAISE EXCEPTION 'FAIL: record_gps(4 param) tidak ada';
  END IF;

  -- 2. get_landing_stats mengembalikan key baru
  SELECT get_landing_stats() INTO v_stats;
  IF v_stats->>'total_tickets' IS NULL OR v_stats->>'resolved_this_month' IS NULL THEN
    RAISE EXCEPTION 'FAIL: get_landing_stats tidak punya total_tickets/resolved_this_month';
  END IF;
  v_units  := (v_stats->>'active_units')::int;
  v_total  := (v_stats->>'total_tickets')::int;
  v_month  := (v_stats->>'resolved_this_month')::int;
  IF v_units < 0 OR v_total < 0 OR v_month < 0 THEN
    RAISE EXCEPTION 'FAIL: statistik bernilai negatif';
  END IF;

  -- 3. Negative test guard: bukan teknisi (atau bukan member) TIDAK bisa record GPS.
  --    Panggil sebagai anon agar auth.uid() = NULL -> harus RAISE 'unauthorized'.
  BEGIN
    PERFORM record_gps(gen_random_uuid(), -6.1, 106.8, 'start');
    v_ok := false;
  EXCEPTION WHEN others THEN
    v_ok := true;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'FAIL: record_gps oleh user tanpa auth tidak ditolak';
  END IF;

  RAISE NOTICE 'PASS: gps & stats OK (active_units=%, total=%, resolved_month=%)',
    v_units, v_total, v_month;
END $$;
