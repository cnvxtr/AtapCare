-- ============================================================
-- 36: Perbaiki overload notify_role yang ambigu.
-- Migration 34 membuat notify_role(text,text,text,uuid DEFAULT NULL)
-- di samping overload lama 3-arg → setiap panggilan 3-arg cocok dua kandidat
-- sekaligus ("function notify_role(unknown, text, text) is not unique"),
-- membatalkan seluruh RPC (update_ticket_status dkk.) sejak 34.
-- Buang overload 3-arg; panggilan 3-arg kini memakai 4-arg (default NULL).
-- ============================================================

DROP FUNCTION IF EXISTS notify_role(text, text, text);

DO $$
DECLARE v_left int;
BEGIN
  -- self-check: tepat 1 overload tersisa, dan panggilan 3-arg harus ter-resolve
  -- (masih ambigu bila overload 3-arg belum benar-benar hilang).
  SELECT count(*) INTO v_left FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'notify_role';
  IF v_left <> 1 THEN
    RAISE EXCEPTION 'notify_role harus tepat 1 fungsi, ditemukan %', v_left;
  END IF;
  PERFORM notify_role('helpdesk', 'selfcheck36', 'selfcheck36');
  DELETE FROM notifications WHERE title = 'selfcheck36';
END $$;
