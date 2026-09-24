CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT role FROM users WHERE id = auth.uid() $$;

DROP POLICY IF EXISTS "users_select_staff" ON users;
CREATE POLICY "users_select_staff" ON users
  FOR SELECT TO authenticated
  USING (current_user_role() IN ('admin','helpdesk','pm','executive','teknisi'));