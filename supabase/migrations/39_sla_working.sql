-- ============================================================
-- 39: SLA stop-the-clock — jam hanya berjalan di status WORKING.
-- BR-28D dipertegas: waktu di NEW/OPEN/UNASSIGNED/SCHEDULED/EN_ROUTE
-- (sudah dari 29) DAN PENDING (menunggu user) TIDAK dihitung.
-- Jam SLA diukur dari ticket_status_history: setiap baris
-- new_status='WORKING' membuka window, transisi status berikutnya
-- menutupnya; rework (RESOLVED→WORKING) otomatis window baru.
-- sla_start_at hanya dicap di WORKING pertama (bukan PENDING).
-- Target jam dibaca live dari sla_config → ubah config berlaku
-- untuk tiket berjalan (tanpa snapshot).
-- Jalankan setelah 38_*.sql.
-- ============================================================

-- Cap sla_start_at HANYA saat pertama masuk WORKING (PENDING bukan
-- status terhitung lagi).
CREATE OR REPLACE FUNCTION log_ticket_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ticket_status_history (ticket_id, old_status, new_status, by_user)
  VALUES (NEW.id, OLD.status, NEW.status, auth.uid());

  IF NEW.status = 'WORKING' AND NEW.sla_start_at IS NULL THEN
    NEW.sla_start_at := now();
  END IF;
  RETURN NEW;
END $$;

-- Menit kerja (08:00–17:00 WIB, Senin–Jumat, lewati libur) dalam rentang
-- [p_from, p_to]. Inversi dari sla_deadline: bukan memajukan cursor, tapi
-- menjumlahkan overlap tiap hari kerja. Aritmetika naive (UTC+7) agar bebas
-- dari timezone sesi (paritas dengan sla_deadline).
CREATE OR REPLACE FUNCTION sla_elapsed_working_minutes(p_from timestamptz, p_to timestamptz)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_holidays text[];
  v_day date;
  v_w_start timestamp;
  v_w_end timestamp;
  v_ov_start timestamp;
  v_ov_end timestamp;
  v_total numeric := 0;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RETURN 0;
  END IF;
  SELECT array_agg(to_char(date, 'YYYY-MM-DD')) INTO v_holidays FROM holidays WHERE is_active;
  FOR v_day IN
    SELECT generate_series(
      ((p_from AT TIME ZONE 'UTC') + interval '7 hours')::date,
      ((p_to AT TIME ZONE 'UTC') + interval '7 hours')::date,
      interval '1 day'
    )::date
  LOOP
    IF extract(dow FROM v_day)::int IN (0, 6) OR to_char(v_day, 'YYYY-MM-DD') = ANY(v_holidays) THEN
      CONTINUE;
    END IF;
    v_w_start := v_day::timestamp + interval '8 hours';
    v_w_end := v_day::timestamp + interval '17 hours';
    v_ov_start := GREATEST((p_from AT TIME ZONE 'UTC') + interval '7 hours', v_w_start);
    v_ov_end := LEAST((p_to AT TIME ZONE 'UTC') + interval '7 hours', v_w_end);
    IF v_ov_end > v_ov_start THEN
      v_total := v_total + extract(epoch FROM (v_ov_end - v_ov_start))::numeric / 60;
    END IF;
  END LOOP;
  RETURN round(v_total);
END $$;

-- Total menit kerja yang sudah terpakai SLA sebuah tiket: jumlah window
-- WORKING dari ticket_status_history (ditutup transisi berikutnya atau
-- sekarang saat masih WORKING). Legacy tanpa riwayat memakai sla_start_at
-- sebagai satu window (setara perilaku lama).
CREATE OR REPLACE FUNCTION sla_working_elapsed(p_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  h record;
  v_open timestamptz;
  v_status text;
  v_closed_at timestamptz;
  v_total numeric := 0;
  v_has_history boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM ticket_status_history WHERE ticket_id = p_id) INTO v_has_history;
  IF NOT v_has_history THEN
    SELECT status, closed_at INTO v_status, v_closed_at FROM tickets WHERE id = p_id;
    IF v_status IS NULL THEN
      RETURN NULL;
    END IF;
    RETURN sla_elapsed_working_minutes(
      (SELECT sla_start_at FROM tickets WHERE id = p_id),
      COALESCE(v_closed_at, now())
    );
  END IF;

  FOR h IN
    SELECT new_status, changed_at
    FROM ticket_status_history
    WHERE ticket_id = p_id
    ORDER BY changed_at, id
  LOOP
    IF h.new_status = 'WORKING' THEN
      IF v_open IS NOT NULL THEN
        v_total := v_total + sla_elapsed_working_minutes(v_open, h.changed_at);
      END IF;
      v_open := h.changed_at;
    ELSIF v_open IS NOT NULL THEN
      v_total := v_total + sla_elapsed_working_minutes(v_open, h.changed_at);
      v_open := NULL;
    END IF;
  END LOOP;

  IF v_open IS NOT NULL THEN
    SELECT status INTO v_status FROM tickets WHERE id = p_id;
    IF v_status = 'WORKING' THEN
      v_total := v_total + sla_elapsed_working_minutes(v_open, now());
    END IF;
  END IF;

  RETURN v_total;
END $$;

-- Sisa SLA = target (live dari sla_config) − jam kerja terpakai.
-- Belum pernah WORKING (sla_start_at NULL) → NULL (SLA belum mulai).
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
  v_elapsed numeric;
BEGIN
  FOR r IN SELECT id, sla_start_at, priority FROM tickets WHERE id = ANY(p_ids) LOOP
    SELECT target_hours INTO v_target FROM sla_config WHERE priority = r.priority;
    IF v_target IS NULL THEN
      v_target := CASE r.priority WHEN 'P1' THEN 4 WHEN 'P2' THEN 24 WHEN 'P3' THEN 72 ELSE 24 END;
    END IF;
    IF r.sla_start_at IS NULL THEN
      ticket_id := r.id;
      remaining_hours := NULL;
      RETURN NEXT;
      CONTINUE;
    END IF;
    v_elapsed := sla_working_elapsed(r.id) / 60;
    ticket_id := r.id;
    remaining_hours := round(v_target - v_elapsed, 1);
    RETURN NEXT;
  END LOOP;
END $$;
