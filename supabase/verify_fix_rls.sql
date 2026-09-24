-- ============================================================
-- VERIFIKASI: register_customer / create_public_ticket setelah fix RLS
-- Jalankan SETELAH menjalankan fix_rls_register.sql
-- ============================================================

-- 1. Pastikan fungsi register_customer ter-expose dengan benar
SELECT proname,
       pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname IN ('register_customer', 'create_public_ticket');

-- 2. Cek user terbaru: customer_id & wa_number harus terisi (tidak NULL)
SELECT id, email, username, name, full_name, wa_number, customer_id, roles, status, is_deleted
FROM users
ORDER BY created_at DESC
LIMIT 5;
