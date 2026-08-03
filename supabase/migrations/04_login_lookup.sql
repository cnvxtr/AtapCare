-- Lookup email by username untuk login (anon tak bisa baca kolom username
-- setelah 03_rls.sql me-revoke SELECT users dari anon kecuali kolom email).
CREATE OR REPLACE FUNCTION resolve_login_email(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM users WHERE username = p_username LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION resolve_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_login_email(text) TO anon, authenticated;
