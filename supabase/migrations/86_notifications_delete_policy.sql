-- 86: Izinkan pemilik menghapus notifikasinya sendiri (tombol "Hapus").
-- 03_rls.sql hanya membuat policy SELECT & UPDATE; tanpa policy DELETE,
-- perintah delete dari aplikasi ditolak diam-diam (0 baris).
DROP POLICY IF EXISTS "notifications_delete_owner" ON notifications;
CREATE POLICY "notifications_delete_owner" ON notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
