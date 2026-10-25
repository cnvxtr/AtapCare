-- 95: Cabut akses anon ke tabel internal.
--
-- Policy anon_all_* (FOR ALL USING(true)) dari 01_admin.sql masih hidup di
-- database produksi, ditambah GRANT tulis penuh untuk anon. Karena anon key
-- bersifat publik (ikut ter-bundle di frontend), siapa pun bisa membaca data
-- pelanggan (nama, PIC, nomor WA) dan mengubah/menghapus master data tanpa login.

DROP POLICY IF EXISTS "anon_all_customers" ON public.customers;
DROP POLICY IF EXISTS "anon_all_sites" ON public.sites;
DROP POLICY IF EXISTS "anon_all_units" ON public.units;
DROP POLICY IF EXISTS "anon_all_regions" ON public.regions;
DROP POLICY IF EXISTS "anon_all_holidays" ON public.holidays;
DROP POLICY IF EXISTS "anon_all_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_all_audit_logs" ON public.audit_logs;

-- Tabel internal: anon tidak butuh akses sama sekali.
-- Akses portal publik lewat RPC SECURITY DEFINER, bukan query tabel langsung.
REVOKE ALL ON public.customers, public.sites, public.units, public.regions,
  public.holidays, public.notifications, public.audit_logs,
  public.fcm_tokens, public.push_subscriptions, public.ticket_status_history,
  public.ticket_assignments, public.ticket_gps, public.activities
FROM anon;

-- Katalog tetap boleh dibaca anon (dipakai form laporan publik), tapi read-only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.problem_categories, public.root_causes FROM anon;

-- Sisa hak yang tidak dipakai API tetapi tidak seharusnya dipegang anon.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.users, public.tickets FROM anon;
