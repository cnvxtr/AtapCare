-- ============================================================
-- 28: Hapus fitur Chatbot (komponen Frontend sudah dihapus).
-- Migrasi ini idempotent: aman dijalankan terlepas apakah 27
-- sudah diterapkan di database target.
-- ============================================================

DROP TABLE IF EXISTS chatbot_faq;
DROP FUNCTION IF EXISTS get_chatbot_faq();
