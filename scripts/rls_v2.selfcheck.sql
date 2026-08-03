-- Self-check matriks state machine (validate_transition) setelah migration 07_rls_v2.sql.
-- Jalankan di SQL Editor / management API. Tanpa JWT: cukup uji fungsi murni.
DO $$
DECLARE
  c record;
  got boolean;
  fails int := 0;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      -- izin helpdesk
      ('helpdesk','NEW','OPEN',true),
      ('helpdesk','NEW','VOID',true),
      ('helpdesk','OPEN','UNASSIGNED',true),
      ('helpdesk','OPEN','RESOLVED',true),
      ('helpdesk','OPEN','CLOSED',true),
      ('helpdesk','RESOLVED','CLOSED',true),
      ('helpdesk','RESOLVED','WORKING',true),   -- rework
      ('helpdesk','CLOSED','WORKING',true),     -- reopen
      ('helpdesk','WORKING','VOID',true),
      ('helpdesk','WORKING','DUPLICATE',true),
      -- tolak helpdesk
      ('helpdesk','NEW','CLOSED',false),
      ('helpdesk','NEW','SCHEDULED',false),
      ('helpdesk','CLOSED','VOID',false),
      ('helpdesk','NEW','WORKING',false),
      -- izin pm
      ('pm','UNASSIGNED','SCHEDULED',true),
      ('pm','SCHEDULED','UNASSIGNED',true),
      ('pm','EN_ROUTE','SCHEDULED',true),      -- re-assign
      ('pm','WORKING','PENDING',true),
      ('pm','PENDING','WORKING',true),
      ('pm','SCHEDULED','SCHEDULED',true),     -- no-op
      -- tolak pm
      ('pm','NEW','OPEN',false),
      ('pm','WORKING','RESOLVED',false),
      ('pm','RESOLVED','CLOSED',false),
      -- izin teknisi
      ('teknisi','SCHEDULED','EN_ROUTE',true),
      ('teknisi','EN_ROUTE','WORKING',true),
      ('teknisi','WORKING','RESOLVED',true),
      ('teknisi','WORKING','PENDING',true),
      ('teknisi','PENDING','WORKING',true),
      -- tolak teknisi
      ('teknisi','NEW','OPEN',false),
      ('teknisi','WORKING','CLOSED',false),
      ('teknisi','CLOSED','WORKING',false),
      ('teknisi','RESOLVED','CLOSED',false),
      -- admin tanpa operasi tiket
      ('admin','NEW','OPEN',false),
      ('admin','WORKING','RESOLVED',false),
      -- pembuatan tiket: hanya helpdesk/pm
      ('helpdesk',NULL,'NEW',true),
      ('pm',NULL,'UNASSIGNED',true),
      ('teknisi',NULL,'NEW',false),
      ('admin',NULL,'NEW',false)
    ) AS t(role, frm, too, expected)
  LOOP
    got := validate_transition(c.role, c.frm, c.too);
    IF got IS DISTINCT FROM c.expected THEN
      RAISE NOTICE 'FAIL %: % -> % (role=%) expected % got %', c.role, c.frm, c.too, c.role, c.expected, got;
      fails := fails + 1;
    END IF;
  END LOOP;

  IF fails > 0 THEN
    RAISE EXCEPTION 'validate_transition selfcheck: % kasus gagal', fails;
  END IF;
  RAISE NOTICE 'validate_transition selfcheck: OK';
END $$;
