-- ============================================================
-- 74: Anti-pemalsuan audit log.
-- Policy audit_insert_authenticated (03_rls.sql) punya WITH CHECK(true):
-- siapa pun yang login BISA menulis baris audit mengaku aktor lain.
-- Fix: trigger BEFORE INSERT memaksa actor_name dari auth.uid() yang
-- sungguhan. Writer tanpa sesi (service role, seed, job) tidak tertimpa
-- karena auth.uid() null. NOL perubahan di frontend.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_audit_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
BEGIN
  -- Hanya sesi login yang dipaksa; writer non-sesi dibiarkan apa adanya.
  IF v_uid IS NOT NULL THEN
    SELECT COALESCE(full_name, name) INTO v_name
    FROM users WHERE id = v_uid;
    IF v_name IS NOT NULL THEN
      NEW.actor_name := v_name;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_set_actor ON audit_logs;
CREATE TRIGGER trg_audit_set_actor
  BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_actor();

-- ── Self-check: tanpa sesi aktor tetap; dengan sesi aktor dipaksa. ──
DO $$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_email text := 'audit-selftest-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) || '@atapcare.local';
  v_actor text;
BEGIN
  -- User dummy memakai FK-bypass (users.id → auth.users), pola migration 34/73.
  -- BLOCK replica hanya di sini: trigger set_audit_actor harus AKTIF saat
  -- insert audit_logs di bawah (replica juga mematikan trigger).
  SET LOCAL session_replication_role = replica;
  INSERT INTO users (id, email, username, name, full_name, role, roles, status, must_change_password, is_deleted)
  VALUES (v_uid, v_email, 'audit-selftest', 'Audit SelfCheck', 'Audit SelfCheck',
          'teknisi', 'teknisi', 'aktif', false, false);
  RESET session_replication_role;

  -- Tanpa sesi: auth.uid() null → actor dari pemanggil dipertahankan.
  INSERT INTO audit_logs (actor_name, action, entity_type, metadata)
  VALUES ('SeedScript', 'selfcheck_no_session', 'selfcheck', '{}'::jsonb);
  SELECT actor_name INTO v_actor FROM audit_logs WHERE action = 'selfcheck_no_session';
  ASSERT v_actor = 'SeedScript', 'tanpa sesi aktor harus tetap, dapat: ' || coalesce(v_actor, 'NULL');

  -- Dengan sesi: actor lama ("Palsu") harus ditindih nama asli.
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid::text)::text, true);
  INSERT INTO audit_logs (actor_name, action, entity_type, metadata)
  VALUES ('Palsu Admin', 'selfcheck_with_session', 'selfcheck', '{}'::jsonb);
  SELECT actor_name INTO v_actor FROM audit_logs WHERE action = 'selfcheck_with_session';
  ASSERT v_actor = 'Audit SelfCheck', 'aktor harus dipaksa ke nama asli, dapat: ' || coalesce(v_actor, 'NULL');

  -- Cleanup (FK-bypass untuk user dummy).
  DELETE FROM audit_logs WHERE action LIKE 'selfcheck%';
  SET LOCAL session_replication_role = replica;
  DELETE FROM users WHERE id = v_uid;
  RESET session_replication_role;
END $$;