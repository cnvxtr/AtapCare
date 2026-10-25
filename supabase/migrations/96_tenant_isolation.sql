-- 96: Batasi policy SELECT lintas-tenant.
--
-- Sebelumnya md_select_authenticated (USING true) membuat SEMUA user login --
-- termasuk customer -- bisa membaca master data perusahaan lain (nama, PIC,
-- nomor WA), GPS teknisi, penugasan, dan riwayat status semua tiket.
-- UI tidak menampilkannya, tetapi API tetap membuka datanya.

-- Helper: customer_id milik user yang login.
CREATE OR REPLACE FUNCTION public.current_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT customer_id FROM users WHERE id = auth.uid() $$;

-- Master data: staff bebas, customer hanya perusahaannya sendiri.
DROP POLICY IF EXISTS "md_select_authenticated" ON public.customers;
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
USING (
  current_user_role() IN ('admin', 'helpdesk', 'pm', 'executive', 'teknisi')
  OR (current_user_role() = 'customer' AND id = current_customer_id())
);

DROP POLICY IF EXISTS "md_select_authenticated" ON public.sites;
CREATE POLICY "sites_select" ON public.sites FOR SELECT TO authenticated
USING (
  current_user_role() IN ('admin', 'helpdesk', 'pm', 'executive', 'teknisi')
  OR (current_user_role() = 'customer' AND customer_id = current_customer_id())
);

DROP POLICY IF EXISTS "md_select_authenticated" ON public.units;
CREATE POLICY "units_select" ON public.units FOR SELECT TO authenticated
USING (
  current_user_role() IN ('admin', 'helpdesk', 'pm', 'executive', 'teknisi')
  OR (current_user_role() = 'customer'
      AND site_id IN (SELECT id FROM sites WHERE customer_id = current_customer_id()))
);

-- Tabel operasional: tidak dipakai portal customer sama sekali.
DROP POLICY IF EXISTS "ta_select_authenticated" ON public.ticket_assignments;
CREATE POLICY "ta_select_staff" ON public.ticket_assignments FOR SELECT TO authenticated
USING (current_user_role() IN ('admin', 'helpdesk', 'pm', 'executive', 'teknisi'));

DROP POLICY IF EXISTS "staff_read_ticket_status_history" ON public.ticket_status_history;
CREATE POLICY "status_history_select" ON public.ticket_status_history FOR SELECT TO authenticated
USING (current_user_role() IN ('admin', 'helpdesk', 'pm', 'executive', 'teknisi'));
