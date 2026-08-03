-- ============================================================
-- ATAP CARE — Notifikasi In-App (Fase 3)
-- Jalankan di Supabase SQL Editor setelah 01_admin.sql.
-- Posture RLS mengikuti tabel eksisting (permissive) karena aplikasi
-- memakai anon key; hardening RLS adalah paket kerja terpisah.
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ponytail: policy "boleh semua" untuk anon — menyamakan posture tabel lain;
-- hardening RLS (berbasis role) adalah paket kerja terpisah.
CREATE POLICY "anon_all_notifications" ON notifications
  FOR ALL USING (true) WITH CHECK (true);
