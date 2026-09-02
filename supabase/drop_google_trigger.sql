-- ============================================================
-- HAPUS TRIGGER PROFIL OTOMATIS (dari migration 54)
-- Trigger on_auth_user_created dipasang migration 54 & disalin di
-- google-user-trigger.sql (Google Login sudah dihapus dari UI/kode).
--
-- Dampak: registrasi via form TETAP JALAN (register_customer punya
-- fallback INSERT). Namun user baru yang dibuat LANGSUNG di
-- auth.users (mis. dari dashboard, tanpa lewat form) TIDAK lagi
-- otomatis mendapat baris profil di tabel users — perlu di-insert
-- manual bila dibutuhkan di masa depan.
--
-- Bisa dijalankan ulang. Biarkan fungsi handle_new_auth_user tetap
-- ada (tidak aktif) bila ingin re-enable mudah; hapus juga bila mau.
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Verifikasi: harus 0 baris
SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND tgname = 'on_auth_user_created';
