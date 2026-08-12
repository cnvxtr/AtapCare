-- ============================================================
-- Self-check 24_duplicate_of.sql (jalankan di Supabase SQL Editor,
-- setelah migration 24 berhasil).
-- Menguji guard non-destruktif (tanpa mutasi data riil).
-- Gagal = ekspektasi tidak terpenuhi.
-- ============================================================

DO $$
DECLARE
  v_uid uuid;
  v_ticket_id uuid;
  v_ticket_code text;
BEGIN
  IF to_regprocedure('update_ticket_status(uuid,text,text,text,text,text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'FAIL: update_ticket_status 8-param tidak ada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'duplicate_of'
  ) THEN
    RAISE EXCEPTION 'FAIL: kolom tickets.duplicate_of tidak ada';
  END IF;

  SELECT id INTO v_uid FROM users WHERE role IN ('admin','helpdesk','pm') LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'FAIL: tidak ada user staff untuk simulasi auth';
  END IF;

  SELECT id, code INTO v_ticket_id, v_ticket_code FROM tickets
  WHERE status IN ('NEW','OPEN','UNASSIGNED','SCHEDULED','EN_ROUTE','WORKING','PENDING')
  ORDER BY created_at DESC LIMIT 1;
  IF v_ticket_id IS NULL THEN
    RAISE NOTICE 'WARN: tidak ada tiket aktif untuk uji guard (skip)';
  ELSE
    PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- Guard 1: self-duplicate harus ditolak.
    BEGIN
      PERFORM update_ticket_status(v_ticket_id, 'DUPLICATE',
        p_activity_action := 'Tiket diduplikasi',
        p_duplicate_of := v_ticket_id);
      RAISE EXCEPTION 'FAIL: self-duplicate seharusnya ditolak';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
    END;

    -- Guard 2: duplicate_of tanpa status DUPLICATE harus ditolak.
    BEGIN
      PERFORM update_ticket_status(v_ticket_id, 'OPEN',
        p_activity_action := 'Tiket divalidasi',
        p_duplicate_of := v_ticket_id);
      RAISE EXCEPTION 'FAIL: duplicate_of di non-DUPLICATE seharusnya ditolak';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
    END;

    -- Guard 3: target tidak ditemukan harus ditolak.
    BEGIN
      PERFORM update_ticket_status(v_ticket_id, 'DUPLICATE',
        p_activity_action := 'Tiket diduplikasi',
        p_duplicate_of := gen_random_uuid());
      RAISE EXCEPTION 'FAIL: duplicate_of target tak ada seharusnya ditolak';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
    END;

    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', '', true);
    RAISE NOTICE 'PASS: guard duplicate_of OK (ticket %)', v_ticket_code;
  END IF;

  RAISE NOTICE 'PASS: kolom duplicate_of + signature 8-param OK';
END $$;
