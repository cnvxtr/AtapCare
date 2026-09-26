-- ============================================================
-- 75: Tutup kebocoran multi-tenancy customer_sites_mapping.
--   1. customer_read_own_mapping (45:519) hanya cek role='customer' —
--      customer bisa baca mapping PERUSAHAAN LAIN. Tambah filter
--      customer_id milik dirinya.
--   2. staff_all_customer_sites_mapping (45:84) FOR ALL USING(true) —
--      SEMUA authenticated bisa baca+tulis mapping apa pun. Sempitkan
--      ke role staff pengelola.
-- Frontend TIDAK membaca tabel ini (ada RPC definer), jadi nol risiko UI.
-- Bila tabel tidak ada di DB (mis. migrasi difish menjadi alur
-- sites.customer_id), seluruh migrasi dilewati bersih tanpa error.
-- ============================================================

DO $$
DECLARE
  v_qual text;
  v_cust text;
  v_staff text;
BEGIN
  IF to_regclass('public.customer_sites_mapping') IS NULL THEN
    RAISE NOTICE '75: customer_sites_mapping tidak ada — dilewati.';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "customer_read_own_mapping" ON customer_sites_mapping;
  CREATE POLICY "customer_read_own_mapping" ON customer_sites_mapping
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
          AND role = 'customer'
          AND customer_id = customer_sites_mapping.customer_id
      )
    );

  DROP POLICY IF EXISTS "staff_all_customer_sites_mapping" ON customer_sites_mapping;
  CREATE POLICY "staff_all_customer_sites_mapping" ON customer_sites_mapping
    FOR ALL TO authenticated
    USING (current_user_role() IN ('admin','helpdesk','pm','executive'))
    WITH CHECK (current_user_role() IN ('admin','helpdesk','pm','executive'));

  -- ── Self-check: policy yang diinginkan terpasang. ──
  SELECT qual::text INTO v_qual
  FROM pg_policies WHERE tablename = 'customer_sites_mapping' AND policyname = 'customer_read_own_mapping';
  ASSERT v_qual IS NOT NULL, 'policy customer_read_own_mapping tidak ada';
  ASSERT v_qual LIKE '%customer_id = customer_sites_mapping.customer_id%',
    'policy customer harus discope customer_id, dapat: ' || v_qual;

  SELECT using_expression::text INTO v_cust
  FROM pg_policies WHERE tablename = 'customer_sites_mapping' AND policyname = 'staff_all_customer_sites_mapping';
  SELECT with_check::text INTO v_staff
  FROM pg_policies WHERE tablename = 'customer_sites_mapping' AND policyname = 'staff_all_customer_sites_mapping';
  ASSERT v_cust IS NOT NULL, 'policy staff_all tidak ada';
  ASSERT v_cust <> 'true' AND v_staff <> 'true',
    'staff_all masih terbuka penuh: using=' || v_cust || ' check=' || v_staff;
  ASSERT v_cust LIKE '%admin%' AND v_cust NOT LIKE '%teknisi%' AND v_cust NOT LIKE '%customer%',
    'staff_all harus tanpa teknisi/customer, dapat: ' || v_cust;
END $$;