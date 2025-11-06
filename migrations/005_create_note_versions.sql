-- Migration: Create note versions table
-- This allows users to save versioned snapshots of their notes with annotations

-- Create note_versions table
CREATE TABLE IF NOT EXISTS note_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  annotation TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure version numbers are unique per note
  UNIQUE(note_id, version_number)
);

-- Create index for fast lookups by note_id
CREATE INDEX IF NOT EXISTS idx_note_versions_note_id
ON note_versions(note_id, version_number DESC);

-- Create index for user's versions
CREATE INDEX IF NOT EXISTS idx_note_versions_user_id
ON note_versions(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for note_versions

-- Users can view their own note versions
CREATE POLICY "Users can view own note versions"
ON note_versions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create versions for their own notes
CREATE POLICY "Users can create versions for own notes"
ON note_versions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own note versions
CREATE POLICY "Users can delete own note versions"
ON note_versions
FOR DELETE
USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON note_versions TO authenticated;
