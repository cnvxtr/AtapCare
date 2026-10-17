-- ============================================================
-- 89: target_role pada notifikasi (multi-role routing).
-- ============================================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_role text;

-- ── notify_user: optional target_role ──
DROP FUNCTION IF EXISTS notify_user(uuid, text, text);
CREATE OR REPLACE FUNCTION notify_user(
  p_uid uuid, p_title text, p_message text, p_target_role text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO notifications (user_id, title, message, target_role)
  VALUES (p_uid, p_title, p_message, p_target_role);
$$;

-- ── notify_role: target_role = p_role ──
DROP FUNCTION IF EXISTS notify_role(text, text, text);
DROP FUNCTION IF EXISTS notify_role(text, text, text, uuid);
CREATE OR REPLACE FUNCTION notify_role(
  p_role text, p_title text, p_message text, p_ticket_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO notifications (user_id, title, message, ticket_id, target_role)
  SELECT id, p_title, p_message, p_ticket_id, p_role FROM users
  WHERE is_deleted = false
    AND (role = p_role OR p_role = ANY(string_to_array(roles, ',')));
$$;

REVOKE EXECUTE ON FUNCTION notify_user(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION notify_role(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION notify_user(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_role(text, text, text, uuid) TO authenticated;