-- ============================================================
-- Storage: bucket ticket-photos (private) + RLS.
-- Foto internal (helpdesk & teknisi) disimpan di sini sebagai
-- path ({code}/{uuid}.jpg) di detail aktivitas, bukan data URL.
-- Portal guest tetap data URL (anon tidak punya akses Storage).
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ticket-photos', 'ticket-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Hanya authenticated yang boleh upload & baca. anon tanpa akses.
-- ponytail: scope SELECT tidak dibatasi per-teknisi (path berisi kode tiket acak,
-- jadi tidak dapat ditebak); kunci per-tiket bisa via trigger/kolom owner jika perlu.
DROP POLICY IF EXISTS "ticket_photos_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "ticket_photos_select_authenticated" ON storage.objects;

CREATE POLICY "ticket_photos_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-photos');

CREATE POLICY "ticket_photos_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-photos');
