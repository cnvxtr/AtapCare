-- ============================================================
-- ATAP CARE — SLA dihitung server-side (Postgres), bukan frontend.
-- Target SLA dari sla_config, jam kerja 08.15-17.00 WIB (Senin-Jumat),
-- lewati libur nasional (holidays). Di-hitung real-time saat dibaca.
-- BR-28D (waktu NEW/OPEN/dll tidak dihitung) belum akurat karena butuh
-- timestamp transisi status; deadline tetap dari created_at (sama dgn
-- perilaku sebelumnya). Upgrade saat backend SLA (Node.js) dibangun.
-- Jalankan setelah 05_fix_legacy_policies.sql.
-- ============================================================

-- Deadline SLA: p_target jam kerja, maju melewati malam, akhir pekan, libur.
-- Aritmetika pada timestamp naive (UTC+7) agar bebas dari timezone sesi.
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
      v_cursor := date_trunc('day', v_cursor) + interval '1 day' + interval '8 hours 15 minutes';
      CONTINUE;
    END IF;
    IF v_min < 495 THEN
      v_cursor := date_trunc('day', v_cursor) + interval '8 hours 15 minutes';
      CONTINUE;
    END IF;
    v_step := LEAST(1020 - v_min, (v_remaining * 60)::int);
    v_cursor := v_cursor + v_step * interval '1 minute';
    v_remaining := v_remaining - v_step::numeric / 60;
  END LOOP;
  RETURN ((v_cursor - interval '7 hours') AT TIME ZONE 'UTC');
END $$;

-- Sisa SLA per tiket (jam; negatif = overdue). SECURITY INVOKER agar RLS
-- tickets berlaku per pemanggil; sla_config/holidays terbaca authenticated.
CREATE OR REPLACE FUNCTION compute_sla_batch(p_ids uuid[])
RETURNS TABLE(ticket_id uuid, remaining_hours numeric)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r record;
  v_target numeric;
  v_deadline timestamptz;
BEGIN
  FOR r IN SELECT id, created_at, priority FROM tickets WHERE id = ANY(p_ids) LOOP
    SELECT target_hours INTO v_target FROM sla_config WHERE priority = r.priority;
    IF v_target IS NULL THEN
      v_target := CASE r.priority WHEN 'P1' THEN 4 WHEN 'P2' THEN 24 WHEN 'P3' THEN 72 ELSE 24 END;
    END IF;
    v_deadline := sla_deadline(r.created_at, v_target);
    ticket_id := r.id;
    remaining_hours := round((extract(epoch FROM (v_deadline - now())) / 3600)::numeric, 1);
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION sla_deadline(timestamptz, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION compute_sla_batch(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sla_deadline(timestamptz, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_sla_batch(uuid[]) TO authenticated;
