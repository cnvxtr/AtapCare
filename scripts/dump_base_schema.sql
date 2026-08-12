-- ============================================================
-- Dump DDL tabel public (BASE SCHEMA) — keamanan kalau DB di-reset.
-- Jalankan di SQL Editor → salin SEMUA output → berikan ke saya,
-- saya simpan jadi supabase/base_schema.sql.
-- Catatan: kolom + default + NOT NULL + PK; FK/constraint tambahan
-- bisa ditambahkan manual nanti bila diperlukan.
-- ============================================================
WITH cols AS (
  SELECT
    c.relname AS tbl,
    quote_ident(a.attname) || ' ' ||
    format_type(a.atttypid, a.atttypmod) ||
    CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN pg_get_expr(d.adbin, d.adrelid) IS NOT NULL
         THEN ' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid) ELSE '' END AS col,
    a.attnum
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND a.attnum > 0 AND NOT a.attisdropped
),
pks AS (
  SELECT
    t.relname AS tbl,
    string_agg(quote_ident(a.attname), ', ' ORDER BY array_position(conkey, a.attnum)) AS pk_cols
  FROM pg_constraint con
  JOIN pg_class t ON t.oid = con.conrelid
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
  WHERE con.contype = 'p'
  GROUP BY t.relname
)
SELECT
  'CREATE TABLE IF NOT EXISTS ' || quote_ident(c.tbl) || ' (' || E'\n' ||
  string_agg(c.col, ',' || E'\n') ||
  CASE WHEN p.pk_cols IS NOT NULL
       THEN ',' || E'\n  PRIMARY KEY (' || p.pk_cols || ')' ELSE '' END ||
  E'\n);' AS ddl
FROM cols c
LEFT JOIN pks p ON p.tbl = c.tbl
GROUP BY c.tbl, p.pk_cols
ORDER BY c.tbl;
