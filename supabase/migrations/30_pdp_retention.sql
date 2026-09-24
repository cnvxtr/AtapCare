-- ============================================================
-- 30: Retensi data pribadi (UU PDP) + alarm PENDING.
-- Masking 6 bulan, anonymize 5 tahun (BAGIAN 2.6).
-- Hanya kolom PII TERSTRUKTUR yang disentuh. Nomor WA pelapor yang
-- tersemat di description tiket TIDAK diubah — edit teks bersifat
-- destruktif dan butuh keputusan retensi dari stakeholder.
-- ponytail: anchor = updated_at (tidak ada kolom last_login);
-- upgrade jika kebijakan retensi membutuhkan anchor aktivitas.
-- Jalankan setelah 29_sla_history.sql.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION mask_pii()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
  rn integer;
BEGIN
  -- Masking: telepon disamarkan setelah 6 bulan tanpa perubahan.
  UPDATE customers SET phone = '0812-xxxx-xxxx', updated_at = now()
  WHERE phone IS NOT NULL AND phone <> '0812-xxxx-xxxx'
    AND updated_at < now() - interval '6 months';
  GET DIAGNOSTICS rn = ROW_COUNT; n := n + rn;

  UPDATE sites SET pic_phone = '0812-xxxx-xxxx', updated_at = now()
  WHERE pic_phone IS NOT NULL AND pic_phone <> '0812-xxxx-xxxx'
    AND updated_at < now() - interval '6 months';
  GET DIAGNOSTICS rn = ROW_COUNT; n := n + rn;

  UPDATE users SET wa_number = '0812-xxxx-xxxx', updated_at = now()
  WHERE wa_number IS NOT NULL AND wa_number <> '0812-xxxx-xxxx'
    AND updated_at < now() - interval '6 months';
  GET DIAGNOSTICS rn = ROW_COUNT; n := n + rn;

  -- Anonymize setelah 5 tahun tanpa perubahan.
  UPDATE customers SET name = 'Anonim', phone = '0812-xxxx-xxxx', address = NULL, updated_at = now()
  WHERE updated_at < now() - interval '5 years';
  GET DIAGNOSTICS rn = ROW_COUNT; n := n + rn;

  UPDATE sites SET pic_name = 'Anonim', pic_phone = '0812-xxxx-xxxx', updated_at = now()
  WHERE updated_at < now() - interval '5 years';
  GET DIAGNOSTICS rn = ROW_COUNT; n := n + rn;

  UPDATE users SET name = 'Anonim', full_name = 'Anonim', wa_number = '0812-xxxx-xxxx', updated_at = now()
  WHERE updated_at < now() - interval '5 years';
  GET DIAGNOSTICS rn = ROW_COUNT; n := n + rn;

  IF n > 0 THEN
    INSERT INTO audit_logs (actor_name, action, entity_type, metadata)
    VALUES ('Sistem', 'retensi_data_pribadi', 'customers/sites/users',
            json_build_object('changed_rows', n));
  END IF;
  RETURN n;
END $$;

-- 02.00 WIB = 19.00 UTC (blueprint: cron harian 02.00 WIB).
SELECT cron.schedule('atapcare-pii-retention', '0 19 * * *', $$SELECT mask_pii()$$);

-- Alarm PENDING: tiket menunggu > 48 jam → notifikasi PM + Helpdesk,
-- sekali saja (pending_alarm_sent_at) agar tidak spam.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pending_alarm_sent_at timestamptz;

CREATE OR REPLACE FUNCTION pending_alarm()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT id, code FROM tickets
    WHERE status = 'PENDING'
      AND pending_alarm_sent_at IS NULL
      AND updated_at <= now() - interval '48 hours'
  LOOP
    UPDATE tickets SET pending_alarm_sent_at = now(), updated_at = now() WHERE id = r.id;
    PERFORM notify_role('pm', 'Pending > 48 jam: ' || r.code,
      'Tiket ' || r.code || ' menunggu lebih dari 48 jam. Segera tindak lanjuti.');
    PERFORM notify_role('helpdesk', 'Pending > 48 jam: ' || r.code,
      'Tiket ' || r.code || ' menunggu lebih dari 48 jam. Segera tindak lanjuti.');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

SELECT cron.schedule('atapcare-pending-alarm', '0 * * * *', $$SELECT pending_alarm()$$);
