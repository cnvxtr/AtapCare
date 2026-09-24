-- Self-check 26_sla_public.sql (jalankan di Supabase SQL Editor,
-- akun anon/authenticated tidak perlu).
-- Non-destruktif: tidak ada mutasi data.

DO $$
DECLARE
  v_stats json;
  v_sla json;
  v_p1 numeric;
  v_p2 numeric;
  v_p3 numeric;
  v_cfg_p1 numeric;
  v_cfg_p2 numeric;
  v_cfg_p3 numeric;
BEGIN
  SELECT get_landing_stats() INTO v_stats;

  -- 1. Field sla ada
  IF v_stats->>'sla' IS NULL THEN
    RAISE EXCEPTION 'FAIL: get_landing_stats tidak punya field sla';
  END IF;
  v_sla := v_stats->'sla';

  -- 2. Nilai SLA cocok dengan sla_config (fallback default bila kosong)
  SELECT COALESCE(MAX(target_hours) FILTER (WHERE priority = 'P1'), 4),
         COALESCE(MAX(target_hours) FILTER (WHERE priority = 'P2'), 24),
         COALESCE(MAX(target_hours) FILTER (WHERE priority = 'P3'), 72)
    INTO v_cfg_p1, v_cfg_p2, v_cfg_p3
    FROM sla_config;

  v_p1 := COALESCE((v_sla->>'P1')::numeric, -1);
  v_p2 := COALESCE((v_sla->>'P2')::numeric, -1);
  v_p3 := COALESCE((v_sla->>'P3')::numeric, -1);

  IF v_p1 <> v_cfg_p1 OR v_p2 <> v_cfg_p2 OR v_p3 <> v_cfg_p3 THEN
    RAISE EXCEPTION 'FAIL: sla landing (%) tidak cocok sla_config (%)',
      json_build_object('P1', v_p1, 'P2', v_p2, 'P3', v_p3),
      json_build_object('P1', v_cfg_p1, 'P2', v_cfg_p2, 'P3', v_cfg_p3);
  END IF;

  RAISE NOTICE 'PASS: sla landing OK (P1=%, P2=%, P3=%)', v_p1, v_p2, v_p3;
END $$;
