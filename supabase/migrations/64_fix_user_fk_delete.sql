-- Migration 64: Fix FK constraints blocking hard-delete of users.
-- Hanya ticket_assignments & ticket_gps di-CASCADE; sisanya SET NULL.
-- Tiket sendiri TIDAK dihapus.

-- ticket_assignments.user_id → CASCADE
ALTER TABLE ticket_assignments
  DROP CONSTRAINT IF EXISTS ticket_assignments_user_id_fkey,
  ADD CONSTRAINT ticket_assignments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ticket_gps.user_id → CASCADE
ALTER TABLE ticket_gps
  DROP CONSTRAINT IF EXISTS ticket_gps_user_id_fkey,
  ADD CONSTRAINT ticket_gps_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- tickets.assigned_to → SET NULL
ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_assigned_to_fkey,
  ADD CONSTRAINT tickets_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- tickets.created_by → SET NULL
ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_created_by_fkey,
  ADD CONSTRAINT tickets_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- activities.user_id → SET NULL
ALTER TABLE activities
  DROP CONSTRAINT IF EXISTS activities_user_id_fkey,
  ADD CONSTRAINT activities_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ticket_status_history.by_user → SET NULL
ALTER TABLE ticket_status_history
  DROP CONSTRAINT IF EXISTS ticket_status_history_by_user_fkey,
  ADD CONSTRAINT ticket_status_history_by_user_fkey
    FOREIGN KEY (by_user) REFERENCES users(id) ON DELETE SET NULL;
