-- ============================================================
-- 23: Portal publik — statistik landing & timeline tamu (Fase 2).
-- Akses portal memakai RPC definer (pola get_sites_for_report /
-- get_ticket_for_tracking), bukan SELECT langsung dari klien.
-- Jalankan setelah 22_catalog.sql.
-- ============================================================

-- ── 1. Statistik landing (badge "N Titik Aktif · <customer>") ──
-- Titik Aktif = unit yang terdaftar di Master Data (is_deleted = false).
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
    ), '{}'::text[])
  );
$$;

REVOKE EXECUTE ON FUNCTION get_landing_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_landing_stats() TO anon, authenticated;

-- ── 2. Timeline tamu: hanya riwayat status (buat + transisi) ──
-- Dilarang membocorkan details (catatan internal), user_id, atau ticket_id.
CREATE OR REPLACE FUNCTION get_public_timeline(p_code text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at), '[]'::json)
  FROM (
    SELECT a.action,
           a.created_at,
           NULLIF(a.user_name, '') AS user_name
    FROM tickets tk
    JOIN activities a ON a.ticket_id = tk.id
    WHERE tk.code = p_code
      AND (a.action LIKE 'Tiket dibuat%' OR a.action LIKE 'Status:%')
  ) t;
$$;

REVOKE EXECUTE ON FUNCTION get_public_timeline(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_timeline(text) TO anon, authenticated;
