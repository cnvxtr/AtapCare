-- ============================================================
-- 77: Cabut EXECUTE overload register_customer yang sudah mati.
-- Overload lama (text,text,text,text,text) dari migration 45 tidak
-- dipanggil siapa pun — pemanggil aktif (AuthContext.tsx) memakai
-- signature baru (text,text,text,uuid,text) dari migration 59.
-- Registrasi customer jalan terus; celah RPC lama ditutup.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.register_customer(text, text, text, text, text) FROM public, anon, authenticated;

-- ── Self-check: overload mati tidak bisa dipanggil; yang aktif tetap. ──
DO $$
BEGIN
  ASSERT NOT has_function_privilege('anon', 'register_customer(text, text, text, text, text)', 'EXECUTE'),
    'overload lama masih dapat dieksekusi anon';
  ASSERT NOT has_function_privilege('authenticated', 'register_customer(text, text, text, text, text)', 'EXECUTE'),
    'overload lama masih dapat dieksekusi authenticated';
  ASSERT has_function_privilege('anon', 'register_customer(text, text, text, uuid, text)', 'EXECUTE'),
    'overload aktif (uuid) hilang dari anon';
  ASSERT has_function_privilege('authenticated', 'register_customer(text, text, text, uuid, text)', 'EXECUTE'),
    'overload aktif (uuid) hilang dari authenticated';
END $$;