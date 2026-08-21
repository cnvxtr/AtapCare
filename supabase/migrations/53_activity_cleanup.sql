-- Migration 53: Cleanup otomatis aktivitas & audit log > 6 bulan.
-- pg_cron sudah ter-install (migration 19, 21, 30, 43).

CREATE OR REPLACE FUNCTION cleanup_old_activities()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM activities WHERE created_at < now() - interval '6 months';
  DELETE FROM audit_logs WHERE created_at < now() - interval '6 months';
END;
$$;

-- Tiap tanggal 1 jam 03:00 UTC (10:00 WIB)
SELECT cron.schedule(
  'atapcare-activity-cleanup',
  '0 3 1 * *',
  $$SELECT cleanup_old_activities()$$
);
