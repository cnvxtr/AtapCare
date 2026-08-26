-- ============================================================
-- 57: Push notification webhook — trigger via pg_net
-- Dipicu saat INSERT ke notifications → POST ke send-push Edge Function.
--
-- SETUP WAJIB (Supabase Dashboard → Settings → Database → postgres.conf):
--   app.settings.service_role_key = '<service-role-key>'
-- (supabase_url sudah di-hardcode di bawah)
--
-- Alternatif: buat DB Webhook manual di Dashboard → Database → Webhooks
--   Table: notifications | Event: INSERT
--   URL: https://heqcgbrgagxdljddhxwn.supabase.co/functions/v1/send-push
--   Headers: Content-Type: application/json
--   Filter: push=eq.true
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_push_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.push IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url    := 'https://heqcgbrgagxdljddhxwn.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('record', to_jsonb(NEW))
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_webhook ON notifications;
CREATE TRIGGER trg_push_webhook
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_webhook();

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_push_webhook'
  ), 'trigger trg_push_webhook not created';
END $$;
