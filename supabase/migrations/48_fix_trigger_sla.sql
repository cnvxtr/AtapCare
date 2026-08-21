-- Fix: trigger log_ticket_status_change still references dropped column sla_start_at.
-- Migration 45 dropped the column but never redefined the trigger.

CREATE OR REPLACE FUNCTION log_ticket_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ticket_status_history (ticket_id, old_status, new_status, by_user)
  VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  RETURN NEW;
END $$;
