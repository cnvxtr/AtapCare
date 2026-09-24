-- ============================================================
-- 25: GPS terstruktur + statistik landing diperkaya (Fase 5).
-- Koordinat Mulai Kerja (start) & Selesai (end) disimpan di
-- tabel ticket_gps (bukan string activity). Tulis hanya lewat
-- RPC record_gps (teknisi yang ditugaskan). Landing stats
-- bertambah: total_tickets & resolved_this_month.
-- Jalankan setelah 24_duplicate_of.sql.
-- ============================================================

-- ── 1. Tabel titik GPS ──
CREATE TABLE IF NOT EXISTS ticket_gps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id),
  lat         double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon         double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
  phase       text NOT NULL CHECK (phase IN ('start', 'end')),
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_gps_ticket ON ticket_gps(ticket_id);

ALTER TABLE ticket_gps ENABLE ROW LEVEL SECURITY;
-- SELECT internal saja (pola sama dgn ticket_assignments); tulis hanya RPC definer.
DROP POLICY IF EXISTS "gps_select_authenticated" ON ticket_gps;
CREATE POLICY "gps_select_authenticated" ON ticket_gps FOR SELECT TO authenticated USING (true);
REVOKE ALL ON ticket_gps FROM anon, authenticated;

-- ── 2. record_gps: hanya teknisi yang ditugaskan (lead/support) ──
CREATE OR REPLACE FUNCTION record_gps(
  p_ticket_id uuid, p_lat double precision, p_lon double precision, p_phase text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_member boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS NULL OR v_role <> 'teknisi' THEN
    RAISE EXCEPTION 'forbidden: only teknisi records GPS';
  END IF;
  IF p_phase NOT IN ('start', 'end') THEN
    RAISE EXCEPTION 'invalid phase';
  END IF;
  IF p_lat BETWEEN -90 AND 90 AND p_lon BETWEEN -180 AND 180 THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'invalid coordinates';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.id = p_ticket_id AND (
      t.assigned_to = v_uid OR
      EXISTS (SELECT 1 FROM ticket_assignments ta WHERE ta.ticket_id = t.id AND ta.user_id = v_uid)
    )
  ) INTO v_member;
  IF NOT v_member THEN RAISE EXCEPTION 'forbidden: not a member of this ticket'; END IF;

  INSERT INTO ticket_gps (ticket_id, user_id, lat, lon, phase)
  VALUES (p_ticket_id, v_uid, p_lat, p_lon, p_phase);
END $$;

REVOKE EXECUTE ON FUNCTION record_gps(uuid, double precision, double precision, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_gps(uuid, double precision, double precision, text) TO authenticated;

-- ── 3. get_landing_stats: + total_tickets & resolved_this_month ──
CREATE OR REPLACE FUNCTION get_landing_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'active_units',
    (SELECT count(*)::int FROM units WHERE is_deleted = false),
    'customers',
    COALESCE((
      SELECT array_agg(DISTINCT c.name ORDER BY c.name)::text[]
      FROM sites s
      JOIN customers c ON c.id = s.customer_id
      WHERE s.is_deleted = false AND c.is_deleted = false
    ), '{}'::text[]),
    'total_tickets',
    (SELECT count(*)::int FROM tickets WHERE status NOT IN ('VOID', 'DUPLICATE')),
    'resolved_this_month',
    (SELECT count(*)::int FROM tickets
     WHERE status IN ('RESOLVED', 'CLOSED')
       AND date_trunc('month', updated_at) = date_trunc('month', now()))
  );
$$;

REVOKE EXECUTE ON FUNCTION get_landing_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_landing_stats() TO anon, authenticated;
