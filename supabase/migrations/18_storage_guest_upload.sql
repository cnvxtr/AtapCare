-- ============================================================
-- 18: Guest upload foto ke Storage (K2).
-- Portal guest (anon) mengunggah foto terkompresi ke bucket
-- private ticket-photos sebagai path, bukan data URL di kolom DB.
-- Bucket tetap private: anon hanya boleh INSERT (folder guest/),
-- tidak boleh SELECT. Internal tetap baca via signed URL.
-- ============================================================

DROP POLICY IF EXISTS "ticket_photos_insert_anon" ON storage.objects;

CREATE POLICY "ticket_photos_insert_anon" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'ticket-photos' AND left(name, 19) = 'ticket-photos/guest');
