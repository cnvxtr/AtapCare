-- Hapus overload record_gps 5-param (p_address) yang tidak pernah dipanggil.
-- Muncul di DB tanpa definisi di repo (artefak reverseGeocode yang sudah dihapus),
-- dan membuat pemanggilan 4-param ambigu (PostgREST menolak memilih kandidat).
-- Versi 4-param (migrations/25_gps_stats.sql) yang dipakai frontend tidak tersentuh.
DROP FUNCTION IF EXISTS record_gps(uuid, double precision, double precision, text, text);