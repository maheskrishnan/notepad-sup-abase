-- Migration: Add composite index for soft delete queries
-- This improves query performance when filtering by user_id, is_deleted, and sorting by updated_at
-- The index supports the common query pattern: WHERE user_id = ? AND is_deleted = ? ORDER BY updated_at DESC

-- Create composite index for filtering active notes
-- This covers the most common query: getting all non-deleted notes for a user, sorted by updated_at
CREATE INDEX IF NOT EXISTS idx_notes_user_deleted_updated
ON notes(user_id, is_deleted, updated_at DESC);

-- Note: This composite index will be used for queries like:
-- SELECT * FROM notes WHERE user_id = ? AND is_deleted = false ORDER BY updated_at DESC
--
-- The index column order matters:
-- 1. user_id - most selective, filters to user's notes
-- 2. is_deleted - further filters to active/deleted notes
-- 3. updated_at DESC - allows efficient sorting without additional sort operation
