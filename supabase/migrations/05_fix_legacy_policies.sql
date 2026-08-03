-- ============================================================
-- ATAP CARE — Perbaikan lubang RLS dari tabel legacy & grant RPC.
-- 1) Drop policy permissive legacy di tickets/activities/users.
-- 2) Cabut EXECUTE anon dari RPC internal (default privilege Supabase
--    memberi EXECUTE ke anon untuk semua fungsi baru).
-- 3) Harden guard admin_save_user terhadap NULL (anon/auth.uid() NULL).
-- Jalankan setelah 04_login_lookup.sql.
-- ============================================================

-- ── 1. Drop policy legacy (scaffold awal app, bukan dari 01_admin) ──
DROP POLICY IF EXISTS "Allow all for authenticated tickets" ON tickets;
DROP POLICY IF EXISTS "Public can insert tickets" ON tickets;
DROP POLICY IF EXISTS "Public can read tickets" ON tickets;
DROP POLICY IF EXISTS "Allow all for authenticated activities" ON activities;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON users;
DROP POLICY IF EXISTS "anon_select_users" ON users;

-- ── 2. RPC internal hanya untuk authenticated ──
-- (default privilege Supabase memberi EXECUTE ke anon; cabut eksplisit)
REVOKE EXECUTE ON FUNCTION admin_save_user(uuid,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION deliver_broadcast(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_save_user(uuid,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION deliver_broadcast(uuid) TO authenticated;

-- ── 3. Harden admin_save_user: auth.uid() NULL harus ditolak ──
CREATE OR REPLACE FUNCTION admin_save_user(
  p_id uuid,
  p_email text,
  p_username text,
  p_name text,
  p_wa_number text,
  p_role text,
  p_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM users WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RETURN json_build_object('error', 'Akses ditolak: hanya Admin');
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE id = p_id) THEN
    UPDATE users
    SET username = p_username, name = p_name, full_name = p_name,
        wa_number = p_wa_number, role = p_role, status = p_status,
        updated_at = now()
    WHERE id = p_id;
  ELSE
    INSERT INTO users (id, email, username, name, full_name, wa_number, role, status, must_change_password, is_deleted)
    VALUES (p_id, p_email, p_username, p_name, p_name, p_wa_number, p_role, p_status, true, false);
  END IF;

  RETURN json_build_object('ok', true);
END $$;
