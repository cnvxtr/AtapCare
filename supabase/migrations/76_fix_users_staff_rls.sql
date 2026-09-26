-- ============================================================
-- 76: Penyempitan users_select_staff.
-- Sebelumnya teknisi boleh SELECT semua baris users (email & WA semua
-- karyawan). Teknisi tidak pernah membaca user lain dari UI (sudah
-- diverifikasi: 6 pembaca users di src/, nol milik teknisi) — jadi
-- menghapus 'teknisi' tidak memutus layar mana pun. Teknisi tetap
-- baca baris sendiri via users_select_own (halaman Profile).
-- ============================================================

DROP POLICY IF EXISTS "users_select_staff" ON users;
CREATE POLICY "users_select_staff" ON users
  FOR SELECT TO authenticated
  USING (current_user_role() IN ('admin','helpdesk','pm','executive'));

-- ── Self-check: policy tanpa teknisi; halaman yang ada tetap terbaca. ──
DO $$
DECLARE
  v_qual text;
BEGIN
  SELECT qual::text INTO v_qual
  FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_select_staff';
  ASSERT v_qual IS NOT NULL, 'policy users_select_staff tidak ada';
  ASSERT v_qual LIKE '%admin%' AND v_qual LIKE '%helpdesk%' AND v_qual LIKE '%pm%'
    AND v_qual LIKE '%executive%' AND v_qual NOT LIKE '%teknisi%',
    'users_select_staff harus staff tanpa teknisi, dapat: ' || v_qual;
END $$;