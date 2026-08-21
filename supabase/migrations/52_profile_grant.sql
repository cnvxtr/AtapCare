-- Migration 52: Izin update profil diri sendiri.
-- Sebelumnya hanya GRANT UPDATE (last_login) — profil gagal diubah dari client.

GRANT UPDATE (full_name, name, username, wa_number, avatar_url) ON users TO authenticated;
