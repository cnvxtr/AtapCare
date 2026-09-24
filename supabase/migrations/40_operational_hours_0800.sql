-- ============================================================
-- 40: Jam operasional mulai 08.00 (sebelumnya 08.15).
-- sla_deadline (06) sudah terlanjur applied → re-create di sini.
-- sla_elapsed_working_minutes (39) belum applied, cukup diubah
-- langsung di file 39. Jam selesai 17.00 WIB tidak berubah.
-- Jalankan setelah 39_sla_working.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION sla_deadline(p_created_at timestamptz, p_target numeric)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cursor timestamp;           -- naive, sudah WIB (+7)
  v_remaining numeric := p_target;
  v_min int;
  v_day int;
  v_holidays text[];
  v_step int;
BEGIN
  SELECT array_agg(to_char(date, 'YYYY-MM-DD')) INTO v_holidays
  FROM holidays WHERE is_active;
  v_cursor := (p_created_at AT TIME ZONE 'UTC') + interval '7 hours';
  WHILE v_remaining > 0 LOOP
    v_day := extract(dow FROM v_cursor)::int;  -- 0=Minggu, 6=Sabtu
    v_min := extract(hour FROM v_cursor)::int * 60 + extract(minute FROM v_cursor)::int;
    IF v_day IN (0, 6) OR to_char(v_cursor, 'YYYY-MM-DD') = ANY(v_holidays) OR v_min >= 1020 THEN
      v_cursor := date_trunc('day', v_cursor) + interval '1 day' + interval '8 hours';
      CONTINUE;
    END IF;
    IF v_min < 480 THEN
      v_cursor := date_trunc('day', v_cursor) + interval '8 hours';
      CONTINUE;
    END IF;
    v_step := LEAST(1020 - v_min, (v_remaining * 60)::int);
    v_cursor := v_cursor + v_step * interval '1 minute';
    v_remaining := v_remaining - v_step::numeric / 60;
  END LOOP;
  RETURN ((v_cursor - interval '7 hours') AT TIME ZONE 'UTC');
END $$;
