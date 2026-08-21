-- ============================================================
-- 38: Timeline publik disamakan dengan timeline drawer (status flow).
-- Sebelumnya get_public_timeline hanya menampilkan 'Tiket dibuat%',
-- 'Status:%', 'Tiket dijeda' — sehingga tiket yang dijadwalkan/dikerjakan
-- hanya terlihat "Laporan Dibuat". Perluas ke aksi alur status yang
-- bermakna bagi pelanggan, dengan sanitasi nama/role di SQL.
--
-- Kebijakan details (halaman tracking = publik/anon, cukup kode tiket):
--   - 'Tiket ditugaskan ke <nama>'   → action jadi 'Tiket ditugaskan ke
--     teknisi', details hanya baris Jadwal (baris 'Pendukung:' dihapus).
--   - 'Tiket dijeda'                 → details penuh (alasan + foto bukti).
--   - aksi lain                      → tanpa details (koordinat GPS, serial,
--     catatan selesai/internal tidak dibocorkan).
-- ============================================================

CREATE OR REPLACE FUNCTION get_public_timeline(p_code text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::json)
  FROM (
    SELECT CASE WHEN a.action LIKE 'Tiket ditugaskan ke%'
                THEN 'Tiket ditugaskan ke teknisi'
                WHEN a.action LIKE 'Tiket divalidasi%'
                THEN 'Tiket divalidasi'
                ELSE a.action
           END AS action,
           a.created_at,
           NULLIF(a.user_name, '') AS user_name,
           CASE
             WHEN a.action = 'Tiket dijeda' THEN a.details
             WHEN a.action LIKE 'Tiket ditugaskan ke%'
               THEN regexp_replace(a.details, '(\n|^)Pendukung:[^\n]*', '', 'g')
             ELSE NULL
           END AS details
    FROM tickets tk
    JOIN activities a ON a.ticket_id = tk.id
    WHERE tk.code = p_code
      AND (
        a.action LIKE 'Tiket dibuat%'
        OR a.action LIKE 'Status:%'
        OR a.action LIKE 'Tiket divalidasi%'
        OR a.action = 'Tiket dijadwalkan'
        OR a.action LIKE 'Tiket ditugaskan ke%'
        OR a.action = 'Teknisi dalam perjalanan'
        OR a.action = 'Pekerjaan dimulai'
        OR a.action = 'Tiket dijeda'
        OR a.action = 'Tugas diselesaikan'
        OR a.action = 'Tiket ditutup'
      )
  ) t;
$$;

REVOKE EXECUTE ON FUNCTION get_public_timeline(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_timeline(text) TO anon, authenticated;

-- Self-check: tidak ada field internal bocor; details hanya untuk
-- 'Tiket dijeda' / 'Tiket ditugaskan ke teknisi'; action tidak memuat nama.
DO $$
DECLARE
  v_code text;
  v_tl json;
  v_item jsonb;
  v_bad_details boolean := false;
  v_name_leak boolean := false;
BEGIN
  SELECT code INTO v_code FROM tickets ORDER BY created_at DESC LIMIT 1;
  IF v_code IS NULL THEN
    RAISE NOTICE 'WARN: tidak ada tiket untuk uji get_public_timeline (skip)';
  ELSE
    SELECT get_public_timeline(v_code) INTO v_tl;
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_tl::jsonb) LOOP
      IF v_item ? 'ticket_id' OR v_item ? 'user_id' THEN
        RAISE EXCEPTION 'FAIL: get_public_timeline membocorkan field internal';
      END IF;
      IF v_item->>'details' IS NOT NULL
         AND v_item->>'action' <> 'Tiket dijeda'
         AND v_item->>'action' <> 'Tiket ditugaskan ke teknisi' THEN
        v_bad_details := true;
      END IF;
      IF v_item->>'action' ~ 'Tiket ditugaskan ke (?!teknisi)' THEN
        v_name_leak := true;
      END IF;
    END LOOP;
    IF v_bad_details THEN
      RAISE EXCEPTION 'FAIL: get_public_timeline membocorkan details aksi lain';
    END IF;
    IF v_name_leak THEN
      RAISE EXCEPTION 'FAIL: get_public_timeline memuat nama pada aksi penugasan';
    END IF;
    RAISE NOTICE 'PASS: timeline publik aman (% entri)', json_array_length(v_tl);
  END IF;
END $$;
