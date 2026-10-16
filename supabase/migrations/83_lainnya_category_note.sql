-- ============================================================
-- 83: Pilihan "Lainnya" di dropdown temuan awal/akhir.
-- Admin mengelola katalog lagi lewat tab Master Data; form memilih
-- dari katalog + item "Lainnya" di paling bawah. Teks bebas saat
-- "Lainnya" TIDAK didaftarkan ke katalog — disimpan di kolom
-- category_note (temuan awal) / root_cause_note (temuan akhir),
-- sementara category_id/root_cause_id menunjuk row resmi 'Lainnya'
-- (seed migrasi 22, dijaga find-or-create) supaya laporan tetap
-- terkelompok rapi dalam satu grup "Lainnya".
-- Jalankan setelah 82_findings_free_text.sql.
-- ============================================================

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category_note text;

-- Re-run aman: drop kedua signature (lama 4-arg + baru 5-arg) sebelum CREATE.
DROP FUNCTION IF EXISTS set_ticket_catalog(uuid, text, text, text);
DROP FUNCTION IF EXISTS set_ticket_catalog(uuid, text, text, text, text);

CREATE FUNCTION set_ticket_catalog(
  p_ticket_id uuid, p_category_name text DEFAULT NULL,
  p_root_cause_name text DEFAULT NULL, p_root_cause_note text DEFAULT NULL,
  p_category_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_full_name text;
  v_category_id uuid;
  v_root_id uuid;
  v_old_category_id uuid;
  v_old_root_id uuid;
  v_old_root_note text;
  v_old_category_note text;
  v_changed boolean;
  v_parts text[] := '{}';
BEGIN
  p_category_name := nullif(trim(p_category_name), '');
  p_root_cause_name := nullif(trim(p_root_cause_name), '');
  p_category_note := nullif(trim(p_category_note), '');

  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS NULL THEN RAISE EXCEPTION 'forbidden: user has no role'; END IF;

  IF v_role = 'teknisi' THEN
    IF p_category_name IS NOT NULL OR p_category_note IS NOT NULL THEN
      RAISE EXCEPTION 'forbidden: teknisi cannot set category';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = p_ticket_id AND (
        t.assigned_to = v_uid OR
        EXISTS (SELECT 1 FROM ticket_assignments ta
                WHERE ta.ticket_id = t.id AND ta.user_id = v_uid)
      )
    ) THEN
      RAISE EXCEPTION 'forbidden: not a member of this ticket';
    END IF;
  ELSIF v_role NOT IN ('admin', 'helpdesk', 'pm') THEN
    RAISE EXCEPTION 'forbidden: no catalog permission';
  END IF;

  SELECT category_id, root_cause_id, root_cause_note, category_note
    INTO v_old_category_id, v_old_root_id, v_old_root_note, v_old_category_note
  FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  -- Find-or-create: nama yang dikirim selalu dari dropdown (sudah ada di
  -- katalog); row 'Lainnya' dijaga tetap ada. Teks bebas TIDAK lewat sini —
  -- masuknya ke category_note / root_cause_note, jadi katalog tetap bersih.
  -- ponytail: tanpa UNIQUE constraint nama, race bisa bikin baris
  -- kembar — upgrade-nya tambah index unik lower(name).
  IF p_category_name IS NOT NULL THEN
    SELECT id INTO v_category_id FROM problem_categories
     WHERE lower(name) = lower(p_category_name) AND is_deleted = false
     ORDER BY id LIMIT 1;
    IF v_category_id IS NULL THEN
      INSERT INTO problem_categories (name, is_deleted)
      VALUES (p_category_name, false) RETURNING id INTO v_category_id;
    END IF;
  END IF;
  IF p_root_cause_name IS NOT NULL THEN
    SELECT id INTO v_root_id FROM root_causes
     WHERE lower(name) = lower(p_root_cause_name) AND is_deleted = false
     ORDER BY id LIMIT 1;
    IF v_root_id IS NULL THEN
      INSERT INTO root_causes (name, is_deleted)
      VALUES (p_root_cause_name, false) RETURNING id INTO v_root_id;
    END IF;
  END IF;

  v_changed := (v_category_id IS NOT NULL AND v_category_id IS DISTINCT FROM v_old_category_id)
            OR (v_root_id IS NOT NULL AND v_root_id IS DISTINCT FROM v_old_root_id)
            OR (p_root_cause_note IS NOT NULL AND p_root_cause_note IS DISTINCT FROM v_old_root_note)
            OR (p_category_note IS NOT NULL AND p_category_note IS DISTINCT FROM v_old_category_note);

  IF v_changed THEN
    UPDATE tickets SET
      category_id = COALESCE(v_category_id, category_id),
      root_cause_id = COALESCE(v_root_id, root_cause_id),
      root_cause_note = COALESCE(p_root_cause_note, root_cause_note),
      category_note = COALESCE(p_category_note, category_note),
      updated_at = now()
    WHERE id = p_ticket_id;

    IF v_category_id IS NOT NULL THEN
      v_parts := v_parts || ('Kategori: ' || p_category_name);
    END IF;
    IF p_category_note IS NOT NULL THEN
      v_parts := v_parts || ('Catatan awal: ' || p_category_note);
    END IF;
    IF v_root_id IS NOT NULL THEN
      v_parts := v_parts || ('Akar masalah: ' || p_root_cause_name);
    END IF;
    IF p_root_cause_note IS NOT NULL THEN
      v_parts := v_parts || ('Catatan: ' || p_root_cause_note);
    END IF;

    SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;
    INSERT INTO activities (ticket_id, user_id, user_name, action, details)
    VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
            'Temuan awal / akhir diperbarui',
            CASE WHEN cardinality(v_parts) > 0 THEN array_to_string(v_parts, E'\n') ELSE NULL END);
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION set_ticket_catalog(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_ticket_catalog(uuid, text, text, text, text) TO authenticated;

-- Self-check: cuma 1 overload (signature lama harus hilang), teks bebas
-- disimpan ke category_note, find-or-create, dan action label tetap.
DO $$
DECLARE
  v_body text;
  v_sig text;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_proc WHERE proname = 'set_ticket_catalog';
  ASSERT v_count = 1, format('FAIL: %s overload tersisa, drop signature lama gagal', v_count);
  SELECT oid::regprocedure::text, prosrc INTO v_sig, v_body
    FROM pg_proc WHERE proname = 'set_ticket_catalog';
  ASSERT v_sig LIKE '%(uuid,text,text,text,text)%', format('FAIL: signature %s', v_sig);
  ASSERT v_body LIKE '%lower(name) = lower(%', 'FAIL: find-or-create hilang';
  ASSERT v_body LIKE '%category_note = COALESCE(p_category_note, category_note)%', 'FAIL: category_note tidak ditulis';
  ASSERT v_body LIKE '%Temuan awal / akhir diperbarui%', 'FAIL: action label berubah';
END $$;
