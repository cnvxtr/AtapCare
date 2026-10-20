-- Migration 92: tandai sumber tiket (public vs internal)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'public';

-- Set source otomatis saat insert: pembuat staff => internal, lainnya => public
CREATE OR REPLACE FUNCTION set_ticket_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source IS NULL OR NEW.source = '' THEN
    IF EXISTS (
      SELECT 1 FROM users
      WHERE id = NEW.created_by_user_id
        AND role IN ('helpdesk', 'admin', 'pm', 'executive')
    ) THEN
      NEW.source := 'internal';
    ELSE
      NEW.source := 'public';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tickets_set_source ON tickets;
CREATE TRIGGER tickets_set_source
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_source();
