-- ============================================================
-- Self-check 23_portal_stats.sql (jalankan di Supabase SQL Editor,
-- setelah migration 23 berhasil).
-- Gagal = ekspektasi tidak terpenuhi.
-- ============================================================

DO $$
DECLARE
  v_stats json;
  v_tl json;
  v_code text;
  v_item jsonb;
  v_units int;
BEGIN
  IF to_regprocedure('get_landing_stats()') IS NULL THEN
    RAISE EXCEPTION 'FAIL: get_landing_stats() tidak ada';
  END IF;
  IF to_regprocedure('get_public_timeline(text)') IS NULL THEN
    RAISE EXCEPTION 'FAIL: get_public_timeline(text) tidak ada';
  END IF;

  SELECT get_landing_stats() INTO v_stats;
  v_units := (v_stats->>'active_units')::int;
  IF v_units IS NULL OR v_units < 0 THEN
    RAISE EXCEPTION 'FAIL: get_landing_stats tidak mengembalikan active_units valid';
  END IF;

  SELECT code INTO v_code FROM tickets ORDER BY created_at DESC LIMIT 1;
  IF v_code IS NULL THEN
    RAISE NOTICE 'WARN: tidak ada tiket untuk uji get_public_timeline (skip)';
  ELSE
    SELECT get_public_timeline(v_code) INTO v_tl;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_tl::jsonb) LOOP
      -- Details diizinkan HANYA pada baris pending (alasan + foto bukti, migration 32).
      IF (v_item->>'details' IS NOT NULL AND v_item->>'action' <> 'Tiket dijeda')
         OR v_item ? 'ticket_id' OR v_item ? 'user_id' THEN
        RAISE EXCEPTION 'FAIL: get_public_timeline membocorkan field internal';
      END IF;
    END LOOP;

    RAISE NOTICE 'PASS: get_public_timeline aman (field terbatas, % entri)', json_array_length(v_tl);
  END IF;

  RAISE NOTICE 'PASS: portal stats OK (active_units = %)', v_units;
END $$;
