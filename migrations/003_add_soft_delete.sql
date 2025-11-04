-- Migration: Add soft delete support to notes table
-- This migration adds an is_deleted boolean column to support soft deletes
-- Notes with is_deleted = TRUE will not show in the main list but can be recovered

-- Add is_deleted column with default FALSE
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Update existing rows to ensure they are marked as not deleted
UPDATE notes SET is_deleted = FALSE WHERE is_deleted IS NULL;

-- Note: No index is created on is_deleted column as per user preference
-- The existing policies already filter based on user_id which is indexed
