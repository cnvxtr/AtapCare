-- ============================================================
-- 26: SLA publik untuk FAQ landing (Fase 5.5).
-- FAQ "Target penyelesaian" perlu tampil dinamis mengikuti
-- perubahan sla_config oleh Admin. sla_config hanya SELECT
-- authenticated (RLS), jadi landing (anon) membaca lewat RPC
-- get_landing_stats (SECURITY DEFINER) yang diperkaya field sla.
-- Jam operasional TIDAK berubah (08.00-17.00 WIB).
-- Jalankan setelah 25_gps_stats.sql.
-- ============================================================

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
       AND date_trunc('month', updated_at) = date_trunc('month', now())),
    'sla',
    COALESCE((SELECT json_object_agg(priority, target_hours) FROM sla_config), '{}'::json)
  );
$$;

REVOKE EXECUTE ON FUNCTION get_landing_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_landing_stats() TO anon, authenticated;
