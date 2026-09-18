-- ============================================================
-- 70: Security hardening (audit keamanan pre-launch)
-- Fix C1, C2, H1, M1, M3:
--   C1: UPDATE/DELETE/INSERT tiket tidak boleh sembarang user
--       (sebelumnya tickets_update_authenticated USING(true) +
--       staff_all_tickets FOR ALL — teknisi bisa tulis tiket apa
--       pun via REST). Semua tulis tiket lewat RPC SECURITY DEFINER.
--   C2: users tidak boleh dibaca semua baris oleh tiap user
--       (users_select_authenticated USING(true) membocorkan email,
--       no WA, role semua user). Ganti: row sendiri + role staff.
--   H1: activities tidak boleh di-insert langsung (pemalsuan
--       riwayat tiket). Insert hanya via RPC.
--   M1: anon tidak boleh SELECT email users (enumerasi akun).
--       Lookup username->email hanya lewat edge function login-email.
--   M3: tiket tidak boleh di-insert langsung oleh authenticated.
-- ============================================================

-- ── 1. TICKETS: cabut policy tulis bebas ──
DROP POLICY IF EXISTS "tickets_update_authenticated" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_authenticated" ON tickets;
DROP POLICY IF EXISTS "anon_insert_only_tickets" ON tickets;
DROP POLICY IF EXISTS "staff_all_tickets" ON tickets;

-- SELECT tetap ada: tickets_select_staff, tickets_select_teknisi_assigned,
--                   customer_own_tickets, executive_all_tickets

-- ── 2. ACTIVITIES: cabut insert bebas ──
DROP POLICY IF EXISTS "activities_insert_authenticated" ON activities;

-- ── 3. USERS: batasi SELECT ke row sendiri + role staff ──
DROP POLICY IF EXISTS "users_select_authenticated" ON users;
DROP POLICY IF EXISTS "users_select_anon_email" ON users;
REVOKE SELECT ON users FROM anon;

CREATE POLICY "users_select_own" ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_select_staff" ON users
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid())
      IN ('admin','helpdesk','pm','executive','teknisi')
  );

-- ── Verifikasi ──
SELECT policyname, permissive, cmd, roles, qual
FROM pg_policies
WHERE tablename IN ('tickets','activities','users')
ORDER BY tablename, policyname;