-- Jenis hari libur: 'holiday' (libur nasional) / 'leave' (cuti bersama).
-- Data lama default 'holiday'; di-backfill otomatis oleh sync (src/services/sla.ts)
-- saat halaman konfigurasi dibuka. Kedua jenis tetap membekukan SLA.
ALTER TABLE holidays ADD COLUMN kind text NOT NULL DEFAULT 'holiday';
