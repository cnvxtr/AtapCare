-- ATAP CARE v3.0 — Level 1 Customer: PIC Perusahaan + Kode
-- Jalankan sekali di Supabase SQL Editor.
-- Menambah kolom PIC & kode pada customers untuk hierarki aset B2B
-- (PIC Perusahaan / Pemegang Kontrak tampil di kolom PIC tabel Master Data).
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS pic_name text,
  ADD COLUMN IF NOT EXISTS pic_phone text;
