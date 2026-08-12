-- ============================================================
-- 42: Web Push — kolom `push` di notifications + tabel push_subscriptions.
-- Semua notif jadi push. (Fitur broadcast tidak dipakai → deliver_broadcast
-- dibuang; tabel broadcasts sudah dihapus dari DB.)
-- ============================================================

-- Broadcast dibuang total: matikan fungsi yatim yang mereferensikan tabel
-- yang sudah dihapus (jika masih ada dari migration 03/05).
DROP FUNCTION IF EXISTS deliver_broadcast(uuid);

-- Semua notif push (default true). Nanti kalau ada jenis notif "diam",
-- cukup set push=false — filter webhook push=eq.true yang menangani.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push boolean NOT NULL DEFAULT true;

-- Subscription push per perangkat. endpoint UNIQUE: satu perangkat satu baris
-- (resubscribe pakai upsert on-conflict, tak perlu RPC/fungsi baru).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owner-scope: user hanya mengelola subscription miliknya (insert/delete sendiri).
-- Edge Function send-push memakai service role (bypass RLS) saat membaca daftar.
CREATE POLICY "push_subscriptions_own" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Self-check ──
-- FK-bypass via session_replication_role (pola migration 34/35); user fiktif
-- dibuat lengkap sesuai kolom NOT NULL yang dipakai admin_save_user (03_rls).
DO $$
DECLARE
  v_uid uuid; v_nid uuid;
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
BEGIN
  SET LOCAL session_replication_role = replica;
  INSERT INTO users (id, email, username, name, full_name, wa_number, role, status)
  VALUES (gen_random_uuid(), 'chk-' || v_suffix || '@local', 'chk-' || v_suffix,
          'Chk 42', 'Chk 42', '', 'teknisi', 'aktif')
  RETURNING id INTO v_uid;

  -- notif biasa default push=true
  INSERT INTO notifications (user_id, title, message) VALUES (v_uid, 'Chk', 'x') RETURNING id INTO v_nid;
  ASSERT (SELECT push FROM notifications WHERE id = v_nid) IS TRUE, 'default push harus true';

  DELETE FROM notifications WHERE id = v_nid;
  DELETE FROM users WHERE id = v_uid;
  RESET session_replication_role;
END $$;
