-- ============================================================
-- 80: Katalog (problem_categories, root_causes) — baca terbuka, tulis hanya admin.
-- Migration 22 memasang "anon_all_*" FOR ALL USING(true) WITH CHECK(true):
-- siapa pun pemegang anon key publik bisa insert/update/delete katalog.
-- Tulis sebenarnya hanya dari /admin/master-data (RoleGate admin, catalogCrud
-- di src/services/master-data.ts). Baca dipakai Helpdesk/Teknisi/TicketDrawer/
-- CustomerTicketDetail/form → tetap dibuka.
-- ============================================================

DROP POLICY IF EXISTS "anon_all_problem_categories" ON problem_categories;
DROP POLICY IF EXISTS "anon_all_root_causes" ON root_causes;

CREATE POLICY "catalog_select_all" ON problem_categories
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "catalog_select_all" ON root_causes
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "catalog_write_admin" ON problem_categories
  FOR ALL TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
CREATE POLICY "catalog_write_admin" ON root_causes
  FOR ALL TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ── Self-check ──
DO $$
BEGIN
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname IN ('anon_all_problem_categories', 'anon_all_root_causes')
  ), 'policy anon_all_* masih ada';
  ASSERT (
    SELECT count(*) FROM pg_policies WHERE policyname = 'catalog_write_admin'
  ) = 2, 'catalog_write_admin tidak lengkap';
  ASSERT (
    SELECT count(*) FROM pg_policies WHERE policyname = 'catalog_select_all'
  ) = 2, 'catalog_select_all tidak lengkap';
END $$;
