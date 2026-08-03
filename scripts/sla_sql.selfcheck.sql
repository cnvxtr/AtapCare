-- Self-check sla_deadline() terhadap expected (paritas dengan scripts/slaCalc.selfcheck.ts).
-- Jalankan di SQL Editor / management API setelah migration 06_sla_server.sql.
DO $$
DECLARE
  c record;
  got timestamptz;
  fails int := 0;
BEGIN
  -- case1-3 tanpa libur nasional
  DELETE FROM holidays WHERE name = '__selfcheck__';
  FOR c IN
    SELECT * FROM (VALUES
      ('case1', '2026-07-20T01:15:00Z', 4, '2026-07-20T05:15:00Z'),
      ('case2', '2026-07-20T08:00:00Z', 4, '2026-07-21T03:15:00Z'),
      ('case3', '2026-07-25T01:15:00Z', 2, '2026-07-27T03:15:00Z')
    ) AS t(label, created, target, expected)
  LOOP
    got := sla_deadline(c.created::timestamptz, c.target);
    IF got <> c.expected::timestamptz THEN
      RAISE NOTICE '%: got %, expected %', c.label, got, c.expected;
      fails := fails + 1;
    END IF;
  END LOOP;

  -- case4: Senin libur nasional (2026-07-20) → mundur ke Selasa
  INSERT INTO holidays (name, date, is_active) VALUES ('__selfcheck__', '2026-07-20', true);
  FOR c IN
    SELECT * FROM (VALUES
      ('case4', '2026-07-20T01:15:00Z', 4, '2026-07-21T05:15:00Z')
    ) AS t(label, created, target, expected)
  LOOP
    got := sla_deadline(c.created::timestamptz, c.target);
    IF got <> c.expected::timestamptz THEN
      RAISE NOTICE '%: got %, expected %', c.label, got, c.expected;
      fails := fails + 1;
    END IF;
  END LOOP;

  DELETE FROM holidays WHERE name = '__selfcheck__';

  IF fails > 0 THEN
    RAISE EXCEPTION 'sla_deadline selfcheck: % kasus gagal', fails;
  END IF;
  RAISE NOTICE 'sla_deadline selfcheck: OK';
END $$;
