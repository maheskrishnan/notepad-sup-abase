-- Run this in your Supabase SQL Editor to check if your schema is set up correctly

-- 1. Check if user_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notes' AND column_name = 'user_id';

-- Expected result: user_id | uuid | NO

-- 2. Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'notes';

-- Expected result: notes | true

-- 3. Check existing policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'notes';

-- Expected result: Should show 4 policies (SELECT, INSERT, UPDATE, DELETE)

-- 4. Check if there are any notes without user_id
SELECT COUNT(*) as notes_without_user_id
FROM notes
WHERE user_id IS NULL;

-- Expected result: 0

-- If any of these checks fail, you need to run the schema from supabase-schema.sql
