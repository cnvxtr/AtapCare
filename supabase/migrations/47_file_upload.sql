-- ============================================================
-- ATAP CARE — Migration 47: Support file upload (non-image)
-- Update bucket ticket-photos: tambah semua tipe file.
-- ============================================================

-- Update allowed_mime_types: tambah semua format umum
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  -- Images
  'image/jpeg', 'image/png', 'image/webp',
  -- Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  -- Archives
  'application/zip',
  'application/x-rar-compressed',
  -- Video
  'video/mp4',
  'video/quicktime',
  'video/webm'
]
WHERE id = 'ticket-photos';
