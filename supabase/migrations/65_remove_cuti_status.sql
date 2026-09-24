-- ============================================================
-- 65: Hapus status 'cuti' dari users.
-- UI (AdminUsers) hanya menawarkan aktif/nonaktif; logika login
-- hanya mengakui nonaktif sebagai blokir. Normalisasi data lama
-- supaya label tampilan tetap rapi.
-- ============================================================
UPDATE users SET status = 'aktif' WHERE status = 'cuti';