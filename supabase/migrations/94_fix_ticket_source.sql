-- 94: Perbaiki deteksi source tiket.
-- Kolom source punya DEFAULT 'public', dan default sudah terisi sebelum
-- trigger BEFORE INSERT jalan. Akibatnya kondisi NEW.source IS NULL tidak
-- pernah benar dan semua tiket tercatat public.

CREATE OR REPLACE FUNCTION set_ticket_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    WHERE id = NEW.created_by_user_id
      AND role IN ('helpdesk', 'admin', 'pm', 'executive')
  ) THEN
    NEW.source := 'internal';
  ELSE
    NEW.source := 'public';
  END IF;
  RETURN NEW;
END $$;

-- Backfill tiket lama memakai role saat ini karena role historis tidak disimpan.
UPDATE tickets t
SET source = CASE
  WHEN EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = t.created_by_user_id
      AND u.role IN ('helpdesk', 'admin', 'pm', 'executive')
  ) THEN 'internal'
  ELSE 'public'
END;
