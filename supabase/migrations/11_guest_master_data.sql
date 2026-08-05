-- ============================================================
-- 11: Data Site/Unit untuk portal publik (/report).
-- RLS master data hanya mengizinkan SELECT untuk authenticated
-- (03_rls.sql), sedangkan portal guest memakai anon key. Guest
-- membaca lewat RPC SECURITY DEFINER, hanya field aman (nama),
-- tanpa PIC/WA/alamat.
-- ============================================================

CREATE OR REPLACE FUNCTION get_sites_for_report()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.customer_name, t.site_name), '[]'::json)
  FROM (
    SELECT c.name AS customer_name,
           s.name AS site_name,
           COALESCE(array_agg(u.name ORDER BY u.name) FILTER (WHERE u.name IS NOT NULL), '{}'::text[]) AS units
    FROM sites s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN units u ON u.site_id = s.id AND u.is_deleted = false
    WHERE s.is_deleted = false
    GROUP BY c.name, s.name
  ) t;
$$;

REVOKE EXECUTE ON FUNCTION get_sites_for_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_sites_for_report() TO anon, authenticated;
