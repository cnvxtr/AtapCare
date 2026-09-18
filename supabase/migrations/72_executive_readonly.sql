DROP POLICY IF EXISTS "executive_all_tickets" ON tickets;
CREATE POLICY "executive_all_tickets" ON tickets
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'executive')
  );

DROP POLICY IF EXISTS "executive_all_activities" ON activities;
CREATE POLICY "executive_all_activities" ON activities
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'executive')
  );