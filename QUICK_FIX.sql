-- QUICK FIX: Run this in your Supabase SQL Editor
-- This will add authentication support to your existing notes table

-- Step 1: Add user_id column to notes table
ALTER TABLE notes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Create index for better performance
CREATE INDEX idx_notes_user_id ON notes(user_id);

-- Step 3: Get your user ID (you'll need this for step 4)
-- Copy the 'id' value from the result of this query:
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Step 4: IMPORTANT - Replace 'YOUR_USER_ID_HERE' with the actual ID from Step 3
-- This assigns all existing notes to your user account
-- UPDATE notes SET user_id = 'YOUR_USER_ID_HERE' WHERE user_id IS NULL;
-- ⬆️ Remove the -- to uncomment this line and replace YOUR_USER_ID_HERE

-- Step 5: Make user_id required (only run after Step 4 is complete)
-- ALTER TABLE notes ALTER COLUMN user_id SET NOT NULL;
-- ⬆️ Remove the -- to uncomment this line after all notes have a user_id

-- Step 6: Drop the old open-access policy
DROP POLICY IF EXISTS "Enable all access for notes" ON notes;

-- Step 7: Create new user-specific policies
CREATE POLICY "Users can view own notes" ON notes
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON notes
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON notes
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON notes
FOR DELETE USING (auth.uid() = user_id);

-- Done! Your database is now ready for authentication.
