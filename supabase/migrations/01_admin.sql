-- ============================================================
-- ATAP CARE v3.0 — Schema Admin (Fase 2)
-- Jalankan di Supabase SQL Editor (satu kali, urut dari atas).
-- RLS mengikuti posture tabel eksisting (permissive untuk anon
-- karena aplikasi memakai anon key di frontend).
-- ============================================================

-- ── 1. Ekstensi tabel users (kolom yang dipakai modul Admin) ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_number text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aktif';
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill: `name` adalah alias display untuk full_name (modul Admin baca `name`)
UPDATE users SET name = full_name WHERE name IS NULL;

-- ── 2. Tabel baru ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  name text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  region_id uuid REFERENCES regions(id) ON DELETE SET NULL,
  pic_name text NOT NULL,
  pic_phone text NOT NULL,
  address text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  serial_number text,
  type text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_name text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sla_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  priority text UNIQUE NOT NULL,
  target_hours numeric NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  recipients text NOT NULL DEFAULT 'semua',
  status text NOT NULL DEFAULT 'terjadwal',
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Seed awal SLA config ──────────────────────────────────
INSERT INTO sla_config (priority, target_hours) VALUES
  ('P1', 4),
  ('P2', 24),
  ('P3', 72)
ON CONFLICT (priority) DO NOTHING;

-- ── 4. RLS permissive (menyamakan posture tabel eksisting) ──
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- ponytail: policy "boleh semua" untuk anon — aplikasi memakai anon key.
-- hardening RLS (berbasis role) adalah pekerjaan terpisah.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','regions','sites','units','audit_logs','sla_config','holidays','broadcasts']
  LOOP
    EXECUTE format('CREATE POLICY "anon_all_%s" ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;
