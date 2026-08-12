-- ============================================================
-- 29: Riwayat status tiket + sla_start_at (BR-28D).
-- BR-28D: waktu di status NEW/OPEN/UNASSIGNED/SCHEDULED/EN_ROUTE
-- TIDAK dihitung dalam SLA. Sebelumnya deadline selalu dihitung
-- dari created_at karena tidak ada timestamp transisi status
-- (catatan di 06_sla_server.sql).
-- Solusi: catat setiap perubahan status di ticket_status_history
-- (SATU trigger menangkap semua jalur update, termasuk fungsi
-- update_ticket_status) + cap kolom sla_start_at SEKALI saat
-- tiket masuk status terhitung (WORKING/PENDING/RESOLVED).
-- Jalankan setelah 28_chatbot_remove.sql.
-- ============================================================

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_start_at timestamptz;

-- Legacy: tiket lama tidak punya riwayat → asumsikan SLA mulai dari created_at.
UPDATE tickets SET sla_start_at = created_at WHERE sla_start_at IS NULL;

CREATE TABLE IF NOT EXISTS ticket_status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  by_user uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_status_history
  ON ticket_status_history (ticket_id, changed_at);

-- Cap sla_start_at di momen transisi agar jam operasional hanya berjalan
-- sejak tiket benar-benar dikerjakan. by_user = NULL untuk cron/Sistem.
CREATE OR REPLACE FUNCTION log_ticket_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ticket_status_history (ticket_id, old_status, new_status, by_user)
  VALUES (NEW.id, OLD.status, NEW.status, auth.uid());

  IF NEW.status IN ('WORKING', 'PENDING', 'RESOLVED') AND NEW.sla_start_at IS NULL THEN
    NEW.sla_start_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ticket_status_change ON tickets;
CREATE TRIGGER trg_ticket_status_change
  BEFORE UPDATE OF status ON tickets
  FOR EACH ROW EXECUTE FUNCTION log_ticket_status_change();

-- Riwayat dibaca semua staff (audit); ditulis hanya via trigger (SECURITY DEFINER).
ALTER TABLE ticket_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_read_ticket_status_history" ON ticket_status_history;
CREATE POLICY "staff_read_ticket_status_history" ON ticket_status_history
  FOR SELECT TO authenticated USING (true);

-- SLA memakai sla_start_at. Tiket yang belum pernah masuk status terhitung
-- (masih NEW/OPEN/dll.) → remaining NULL (SLA belum mulai, BR-28D).
CREATE OR REPLACE FUNCTION compute_sla_batch(p_ids uuid[])
RETURNS TABLE(ticket_id uuid, remaining_hours numeric)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r record;
  v_target numeric;
  v_deadline timestamptz;
BEGIN
  FOR r IN SELECT id, created_at, sla_start_at, priority FROM tickets WHERE id = ANY(p_ids) LOOP
    SELECT target_hours INTO v_target FROM sla_config WHERE priority = r.priority;
    IF v_target IS NULL THEN
      v_target := CASE r.priority WHEN 'P1' THEN 4 WHEN 'P2' THEN 24 WHEN 'P3' THEN 72 ELSE 24 END;
    END IF;
    IF r.sla_start_at IS NULL THEN
      ticket_id := r.id;
      remaining_hours := NULL;
      RETURN NEXT;
      CONTINUE;
    END IF;
    v_deadline := sla_deadline(r.sla_start_at, v_target);
    ticket_id := r.id;
    remaining_hours := round((extract(epoch FROM (v_deadline - now())) / 3600)::numeric, 1);
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION compute_sla_batch(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION compute_sla_batch(uuid[]) TO authenticated;
