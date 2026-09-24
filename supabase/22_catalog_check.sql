-- ============================================================
-- Self-check 22_catalog.sql (jalankan di Supabase SQL Editor,
-- setelah migration 22 berhasil).
-- Gagal = ekspektasi tidak terpenuhi.
-- ============================================================

DO $$
DECLARE
  v_cat_count int;
  v_root_count int;
  v_ticket_id uuid;
  v_root_id uuid;
  v_uid uuid;
BEGIN
  SELECT count(*) INTO v_cat_count FROM problem_categories WHERE is_deleted = false;
  IF v_cat_count <> 5 THEN
    RAISE EXCEPTION 'FAIL: problem_categories aktif = %, expect 5', v_cat_count;
  END IF;

  SELECT count(*) INTO v_root_count FROM root_causes WHERE is_deleted = false;
  IF v_root_count <> 5 THEN
    RAISE EXCEPTION 'FAIL: root_causes aktif = %, expect 5', v_root_count;
  END IF;

  -- Ambil tiket aktif (paling baru) sebagai target uji.
  SELECT id INTO v_ticket_id FROM tickets
  WHERE status IN ('NEW','OPEN','UNASSIGNED','SCHEDULED','EN_ROUTE','WORKING','PENDING')
  ORDER BY created_at DESC LIMIT 1;

  IF v_ticket_id IS NULL THEN
    RAISE NOTICE 'WARN: tidak ada tiket aktif untuk uji set_ticket_catalog (skip)';
  ELSE
    SELECT id INTO v_root_id FROM root_causes WHERE name = 'Lainnya' LIMIT 1;

    -- Simulasi sesi authenticated agar auth.uid() bernilai user staff sungguhan.
    -- (dari SQL Editor auth.uid() = NULL, dan set_ticket_catalog menolak NULL).
    SELECT id INTO v_uid FROM users
    WHERE role IN ('admin','helpdesk','pm') LIMIT 1;

    IF v_uid IS NULL THEN
      RAISE NOTICE 'WARN: tidak ada user staff untuk uji set_ticket_catalog (skip)';
    ELSE
      PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

      PERFORM set_ticket_catalog(v_ticket_id, NULL, v_root_id, 'self-check');

      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claim.role', '', true);

      IF NOT EXISTS (
        SELECT 1 FROM tickets WHERE id = v_ticket_id AND root_cause_id = v_root_id
      ) THEN
        RAISE EXCEPTION 'FAIL: root_cause_id tidak tersimpan';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM activities WHERE ticket_id = v_ticket_id AND action = 'Kategori / akar masalah diperbarui'
      ) THEN
        RAISE EXCEPTION 'FAIL: aktivitas katalog tidak tercatat';
      END IF;

      RAISE NOTICE 'PASS: set_ticket_catalog tersimpan + tercatat (ticket %)', v_ticket_id;
    END IF;
  END IF;

  RAISE NOTICE 'PASS: katalog seed OK (5 kategori, 5 root cause)';
END $$;
