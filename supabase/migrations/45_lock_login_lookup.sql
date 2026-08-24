-- ============================================================
-- 45: Kunci resolve_login_email — RPC ini tidak lagi dipanggil dari
-- klien; penggantinya Edge Function login-email yang memverifikasi
-- kata sandi lebih dulu sebelum membuka email (akses hanya via
-- service_role). Cabut seluruh hak eksekusi publik agar email
-- tidak bisa dipanen dari nama pengguna.
-- ============================================================

REVOKE EXECUTE ON FUNCTION resolve_login_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION resolve_login_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION resolve_login_email(text) FROM authenticated;
