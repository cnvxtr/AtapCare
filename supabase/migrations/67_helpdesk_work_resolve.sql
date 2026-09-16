-- Migration 67: Helpdesk menindaklanjuti tiket reopen/rework dari status WORKING.
-- Eskalasi ke PM (WORKING→UNASSIGNED) & Selesaikan Remote sukses (WORKING→CLOSED).
CREATE OR REPLACE FUNCTION validate_transition(p_role text, p_from text, p_to text)
RETURNS boolean
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  -- p_from NULL = pembuatan tiket baru
  IF p_from IS NULL THEN
    RETURN p_role IN ('helpdesk', 'pm');
  END IF;
  -- no-op: tidak ada perubahan status
  IF p_from = p_to THEN
    RETURN true;
  END IF;

  IF p_role = 'helpdesk' THEN
    RETURN
      (p_to IN ('VOID', 'DUPLICATE')
        AND p_from NOT IN ('CLOSED', 'VOID', 'DUPLICATE'))
      OR (p_from = 'NEW' AND p_to = 'OPEN')
      OR (p_from = 'OPEN' AND p_to IN ('UNASSIGNED', 'RESOLVED', 'CLOSED'))
      OR (p_from = 'RESOLVED' AND p_to IN ('CLOSED', 'WORKING')) -- rework (alasan wajib)
      OR (p_from = 'CLOSED' AND p_to = 'WORKING')                -- reopen
      OR (p_from = 'WORKING' AND p_to IN ('UNASSIGNED', 'CLOSED')); -- tindak lanjut reopen/rework
  END IF;

  IF p_role = 'pm' THEN
    RETURN
      (p_from = 'UNASSIGNED' AND p_to = 'SCHEDULED')
      OR (p_from = 'SCHEDULED' AND p_to IN ('UNASSIGNED', 'SCHEDULED'))
      OR (p_from = 'EN_ROUTE' AND p_to IN ('UNASSIGNED', 'SCHEDULED')) -- re-assign
      OR (p_from = 'WORKING' AND p_to IN ('UNASSIGNED', 'PENDING'))
      OR (p_from = 'PENDING' AND p_to = 'WORKING');
  END IF;

  IF p_role = 'teknisi' THEN
    RETURN
      (p_from = 'SCHEDULED' AND p_to = 'EN_ROUTE')
      OR (p_from = 'EN_ROUTE' AND p_to IN ('WORKING', 'PENDING'))
      OR (p_from = 'WORKING' AND p_to IN ('RESOLVED', 'PENDING'))
      OR (p_from = 'PENDING' AND p_to = 'WORKING');
  END IF;

  RETURN false;
END $$;