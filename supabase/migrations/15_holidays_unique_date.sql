-- Satu libur nasional per tanggal: bersihkan duplikat yang terlanjur masuk
-- (sinkronisasi berjalan ganda di dev StrictMode), lalu kunci dengan UNIQUE.
DELETE FROM holidays a
USING holidays b
WHERE a.date = b.date AND a.id > b.id;

ALTER TABLE holidays ADD CONSTRAINT holidays_date_unique UNIQUE (date);
