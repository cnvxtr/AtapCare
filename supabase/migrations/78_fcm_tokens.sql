-- ============================================================
-- 78: FCM token per perangkat Android — notifikasi native (APK).
-- Web Push (push_subscriptions, VAPID) tetap utuh untuk browser;
-- dua channel terpisah, keduanya dibaca oleh edge function send-push.
-- ============================================================

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON fcm_tokens (user_id);

ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Owner-scope: user hanya mengelola token miliknya (insert/delete sendiri).
-- Edge Function send-push memakai service role (bypass RLS) saat membaca daftar.
DROP POLICY IF EXISTS "fcm_tokens_own" ON fcm_tokens;
CREATE POLICY "fcm_tokens_own" ON fcm_tokens
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Self-check ──
-- FK-bypass via session_replication_role (pola migration 34/42/43).
DO $$
DECLARE
  v_uid uuid; v_tid uuid;
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
BEGIN
  SET LOCAL session_replication_role = replica;

  INSERT INTO users (id, email, username, name, full_name, wa_number, role, status)
  VALUES (gen_random_uuid(), 'chk-' || v_suffix || '@local', 'chk-' || v_suffix,
          'Chk 78', 'Chk 78', '', 'teknisi', 'aktif')
  RETURNING id INTO v_uid;

  INSERT INTO fcm_tokens (user_id, token)
  VALUES (v_uid, 'chk-token-' || v_suffix)
  RETURNING id INTO v_tid;

  -- unique per token: menancapkan token sama dua kali harus gagal.
  BEGIN
    INSERT INTO fcm_tokens (user_id, token) VALUES (v_uid, 'chk-token-' || v_suffix);
    RAISE EXCEPTION 'unik token gagal: duplikat diterima';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- ok
  END;

  DELETE FROM fcm_tokens WHERE id = v_tid;
  DELETE FROM users WHERE id = v_uid;
  RESET session_replication_role;
END $$;