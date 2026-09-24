-- ============================================================
-- ATAP CARE — Migration 46: RLS policy untuk role executive
-- Executive perlu SELECT semua tiket & aktivitas (read-only monitoring).
-- Policy ditambahkan sebagai policy terpisah agar tidak mengganggu
-- policy lama (admin/helpdesk/pm/teknisi) yang sudah berjalan.
-- ============================================================

-- 1. Tickets: executive bisa baca semua tiket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'executive_all_tickets' AND tablename = 'tickets'
  ) THEN
    CREATE POLICY "executive_all_tickets" ON tickets
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'executive')
      );
  END IF;
END $$;

-- 2. Activities: executive bisa baca semua aktivitas tiket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'executive_all_activities' AND tablename = 'activities'
  ) THEN
    CREATE POLICY "executive_all_activities" ON activities
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'executive')
      );
  END IF;
END $$;
