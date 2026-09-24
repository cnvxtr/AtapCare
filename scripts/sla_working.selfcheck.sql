-- Self-check SLA stop-the-clock (39_sla_working.sql). Jalankan di SQL Editor.
-- Data scratch dihapus di akhir; jika ada yang gagal → RAISE EXCEPTION
-- membatalkan seluruh transaksi.
DO $$
DECLARE
  fails int := 0;
  v_min numeric;
  v_target numeric;
  v_expected numeric;
  v_remaining numeric;
  v_remaining2 numeric;
  v_ticket uuid;
  v_ticket2 uuid;
BEGIN
  -- ── sla_elapsed_working_minutes ──
  -- case1: Jumat 2026-07-24 09:00→16:00 WIB = 7 jam = 420 menit
  v_min := sla_elapsed_working_minutes('2026-07-24T02:00:00Z', '2026-07-24T09:00:00Z');
  IF v_min <> 420 THEN RAISE NOTICE 'case1: got %', v_min; fails := fails + 1; END IF;

  -- case2: Jumat 16:00 WIB → Senin 09:00 WIB = 60 (Jumat) + 60 (Senin 08:00-09:00) = 120
  v_min := sla_elapsed_working_minutes('2026-07-24T09:00:00Z', '2026-07-27T02:00:00Z');
  IF v_min <> 120 THEN RAISE NOTICE 'case2: got %', v_min; fails := fails + 1; END IF;

  -- case3: Senin 2026-07-27 libur → hanya Selasa 08:00-09:00 = 60 menit
  INSERT INTO holidays (name, date, is_active) VALUES ('__selfcheck__', '2026-07-27', true);
  v_min := sla_elapsed_working_minutes('2026-07-26T17:00:00Z', '2026-07-28T02:00:00Z');
  IF v_min <> 60 THEN RAISE NOTICE 'case3: got %', v_min; fails := fails + 1; END IF;
  DELETE FROM holidays WHERE name = '__selfcheck__';

  -- ── sla_working_elapsed + compute_sla_batch (tiket scratch) ──
  -- Flow (Senin 2026-07-20, semua WIB): WORKING 08:00→11:00 (180'),
  -- PENDING 11:00→14:00 (tidak dihitung), WORKING 14:00→15:00 (60'),
  -- RESOLVED 15:00. Total terpakai = 240 menit = 4.0 jam.
  INSERT INTO tickets (code, customer, company, site, unit, location, category, description, status, priority, created_by, sla_start_at)
  VALUES ('__selfcheck__', 'selfcheck', 'selfcheck', NULL, NULL, NULL, NULL, 'selfcheck', 'RESOLVED', 'P1', NULL, '2026-07-20T00:15:00Z')
  RETURNING id INTO v_ticket;

  INSERT INTO ticket_status_history (ticket_id, old_status, new_status, changed_at, by_user)
  VALUES
    (v_ticket, 'NEW', 'WORKING', '2026-07-20T00:15:00Z', NULL),
    (v_ticket, 'WORKING', 'PENDING', '2026-07-20T04:00:00Z', NULL),
    (v_ticket, 'PENDING', 'WORKING', '2026-07-20T07:00:00Z', NULL),
    (v_ticket, 'WORKING', 'RESOLVED', '2026-07-20T08:00:00Z', NULL);

  SELECT target_hours INTO v_target FROM sla_config WHERE priority = 'P1';
  IF v_target IS NULL THEN v_target := 4; END IF;
  v_expected := round(v_target - 4.0, 1);

  SELECT remaining_hours INTO v_remaining FROM compute_sla_batch(ARRAY[v_ticket]) WHERE ticket_id = v_ticket;
  IF v_remaining IS NULL OR v_remaining <> v_expected THEN
    RAISE NOTICE 'case4: got %, expected %', v_remaining, v_expected;
    fails := fails + 1;
  END IF;

  -- case5: PENDING saja, belum pernah WORKING → remaining NULL (BR-28D)
  INSERT INTO tickets (code, customer, company, site, unit, location, category, description, status, priority, created_by)
  VALUES ('__selfcheck2__', 'selfcheck', 'selfcheck', NULL, NULL, NULL, NULL, 'selfcheck', 'PENDING', 'P2', NULL)
  RETURNING id INTO v_ticket2;

  INSERT INTO ticket_status_history (ticket_id, old_status, new_status, changed_at, by_user)
  VALUES (v_ticket2, 'NEW', 'PENDING', '2026-07-20T00:15:00Z', NULL);

  SELECT remaining_hours INTO v_remaining2 FROM compute_sla_batch(ARRAY[v_ticket2]) WHERE ticket_id = v_ticket2;
  IF v_remaining2 IS NOT NULL THEN
    RAISE NOTICE 'case5: expected NULL, got %', v_remaining2;
    fails := fails + 1;
  END IF;

  -- bersihkan data scratch
  DELETE FROM tickets WHERE code IN ('__selfcheck__', '__selfcheck2__');

  IF fails > 0 THEN
    RAISE EXCEPTION 'sla_working selfcheck: % kasus gagal', fails;
  END IF;
  RAISE NOTICE 'sla_working selfcheck: OK';
END $$;
