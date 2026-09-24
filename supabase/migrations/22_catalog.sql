-- ============================================================
-- 22: Master Kategori Masalah & Akar Masalah (Fase 1).
-- Fondasi untuk laporan Top 10 Root Cause dan wizard portal.
-- Tabel memakai posture RLS permissive (anon) sama dgn master
-- data lain (01_admin.sql). Mutasi tiket tetap via RPC definer.
-- Jalankan setelah 21_rate_limit.sql.
-- ============================================================

-- ── 1. Tabel katalog ──
CREATE TABLE IF NOT EXISTS problem_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS root_causes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── 2. Kolom tiket (nullable; diisi helpdesk/teknisi) ──
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES problem_categories(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS root_cause_id uuid REFERENCES root_causes(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS root_cause_note text;

CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_root_cause ON tickets(root_cause_id);

-- ── 3. Seed awal (idempotent per-nama, boleh soft-delete lalu buat ulang) ──
INSERT INTO problem_categories (name)
SELECT 'Mati Total' WHERE NOT EXISTS (SELECT 1 FROM problem_categories WHERE name = 'Mati Total');
INSERT INTO problem_categories (name)
SELECT 'Nilai Tidak Sesuai' WHERE NOT EXISTS (SELECT 1 FROM problem_categories WHERE name = 'Nilai Tidak Sesuai');
INSERT INTO problem_categories (name)
SELECT 'Kerusakan Fisik' WHERE NOT EXISTS (SELECT 1 FROM problem_categories WHERE name = 'Kerusakan Fisik');
INSERT INTO problem_categories (name)
SELECT 'Gangguan Koneksi' WHERE NOT EXISTS (SELECT 1 FROM problem_categories WHERE name = 'Gangguan Koneksi');
INSERT INTO problem_categories (name)
SELECT 'Lainnya' WHERE NOT EXISTS (SELECT 1 FROM problem_categories WHERE name = 'Lainnya');

INSERT INTO root_causes (name)
SELECT 'Kerusakan Sensor' WHERE NOT EXISTS (SELECT 1 FROM root_causes WHERE name = 'Kerusakan Sensor');
INSERT INTO root_causes (name)
SELECT 'Gangguan Koneksi' WHERE NOT EXISTS (SELECT 1 FROM root_causes WHERE name = 'Gangguan Koneksi');
INSERT INTO root_causes (name)
SELECT 'Kesalahan Instalasi' WHERE NOT EXISTS (SELECT 1 FROM root_causes WHERE name = 'Kesalahan Instalasi');
INSERT INTO root_causes (name)
SELECT 'Gangguan Power' WHERE NOT EXISTS (SELECT 1 FROM root_causes WHERE name = 'Gangguan Power');
INSERT INTO root_causes (name)
SELECT 'Lainnya' WHERE NOT EXISTS (SELECT 1 FROM root_causes WHERE name = 'Lainnya');

-- ── 4. RLS permissive (menyamakan posture tabel eksisting) ──
ALTER TABLE problem_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_causes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['problem_categories','root_causes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_all_%s" ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- ── 5. set_ticket_catalog: isi kategori/akar masalah per tiket ──
-- RPC terpisah (bukan menambah update_ticket_status) agar tidak membuat
-- overload fungsi kritis dengan body 75 baris — diff lebih kecil & aman.
-- Teknisi: hanya root cause, hanya tiket miliknya (lead/support).
-- Staff (admin/helpdesk/pm): kategori + root cause, tiket mana pun.
CREATE OR REPLACE FUNCTION set_ticket_catalog(
  p_ticket_id uuid, p_category_id uuid DEFAULT NULL,
  p_root_cause_id uuid DEFAULT NULL, p_root_cause_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_code text;
  v_full_name text;
  v_category_name text;
  v_root_name text;
  v_parts text[] := '{}';
  v_old_category_id uuid;
  v_old_root_id uuid;
  v_old_root_note text;
  v_changed boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role INTO v_role FROM users WHERE id = v_uid;
  IF v_role IS NULL THEN RAISE EXCEPTION 'forbidden: user has no role'; END IF;

  IF v_role = 'teknisi' THEN
    IF p_category_id IS NOT NULL THEN
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

  SELECT code, category_id, root_cause_id, root_cause_note
    INTO v_code, v_old_category_id, v_old_root_id, v_old_root_note
  FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  -- No-op guard: klik kategori/akar masalah berulang dengan nilai sama tidak
  -- menulis entri timeline baru (pola yang sama dgn no-op guard di migration 35).
  v_changed := (p_category_id IS NOT NULL AND p_category_id IS DISTINCT FROM v_old_category_id)
            OR (p_root_cause_id IS NOT NULL AND p_root_cause_id IS DISTINCT FROM v_old_root_id)
            OR (p_root_cause_note IS NOT NULL AND p_root_cause_note IS DISTINCT FROM v_old_root_note);

  IF v_changed THEN
    UPDATE tickets SET
      category_id = COALESCE(p_category_id, category_id),
      root_cause_id = COALESCE(p_root_cause_id, root_cause_id),
      root_cause_note = COALESCE(p_root_cause_note, root_cause_note),
      updated_at = now()
    WHERE id = p_ticket_id;

    IF p_category_id IS NOT NULL THEN
      SELECT name INTO v_category_name FROM problem_categories WHERE id = p_category_id;
      v_parts := v_parts || ('Kategori: ' || COALESCE(v_category_name, '?'));
    END IF;
    IF p_root_cause_id IS NOT NULL THEN
      SELECT name INTO v_root_name FROM root_causes WHERE id = p_root_cause_id;
      v_parts := v_parts || ('Akar masalah: ' || COALESCE(v_root_name, '?'));
    END IF;
    IF p_root_cause_note IS NOT NULL THEN
      v_parts := v_parts || ('Catatan: ' || p_root_cause_note);
    END IF;

    SELECT full_name INTO v_full_name FROM users WHERE id = v_uid;
    INSERT INTO activities (ticket_id, user_id, user_name, action, details)
    VALUES (p_ticket_id, v_uid, COALESCE(v_full_name, ''),
            'Kategori / akar masalah diperbarui',
            CASE WHEN cardinality(v_parts) > 0 THEN array_to_string(v_parts, E'\n') ELSE NULL END);
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION set_ticket_catalog(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_ticket_catalog(uuid, uuid, uuid, text) TO authenticated;

-- ── 6. Self-check: semantik no-op guard (transkripsi ekspresi v_changed) ──
DO $$
DECLARE
  v_cat uuid := gen_random_uuid();
  v_changed boolean;
BEGIN
  -- Semua param NULL (jangan ubah apa pun) → no-op.
  v_changed := (NULL IS NOT NULL AND NULL IS DISTINCT FROM v_cat)
            OR (NULL IS NOT NULL AND NULL IS DISTINCT FROM NULL)
            OR (NULL IS NOT NULL AND NULL IS DISTINCT FROM NULL);
  ASSERT NOT v_changed, 'semua param NULL harus no-op';

  -- Nilai baru sama dengan nilai lama → no-op.
  v_changed := (v_cat IS NOT NULL AND v_cat IS DISTINCT FROM v_cat)
            OR (NULL IS NOT NULL AND NULL IS DISTINCT FROM NULL)
            OR (NULL IS NOT NULL AND NULL IS DISTINCT FROM NULL);
  ASSERT NOT v_changed, 'nilai sama harus no-op';

  -- Nilai baru terisi saat lama NULL → berubah (harus tulis entri).
  v_changed := (v_cat IS NOT NULL AND v_cat IS DISTINCT FROM NULL)
            OR (NULL IS NOT NULL AND NULL IS DISTINCT FROM NULL)
            OR (NULL IS NOT NULL AND NULL IS DISTINCT FROM NULL);
  ASSERT v_changed, 'isi baru saat lama NULL harus berubah';
END $$;
