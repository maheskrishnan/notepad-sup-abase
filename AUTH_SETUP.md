# Authentication Setup Guide

This guide will help you set up user authentication for your Notepad application.

## 1. Update Database Schema

Run the updated schema from `supabase-schema.sql` in your Supabase SQL Editor. This will:

- Add `user_id` column to the notes table
- Create proper Row Level Security (RLS) policies
- Set up foreign key constraints to auth.users

**Important**: If you have existing notes in your database, you'll need to either:

### Option A: Start Fresh (Recommended for Development)
```sql
-- Drop existing table and recreate
DROP TABLE IF EXISTS notes CASCADE;
```
Then run the complete schema from `supabase-schema.sql`.

### Option B: Migrate Existing Data
If you have important existing notes, you'll need to:

1. First, backup your data:
```sql
-- Create a backup
CREATE TABLE notes_backup AS SELECT * FROM notes;
```

2. Add a temporary nullable user_id column:
```sql
-- Add user_id column (nullable first)
ALTER TABLE notes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
```

3. Assign all existing notes to a specific user (you'll need a user ID):
```sql
-- Replace 'YOUR_USER_ID_HERE' with an actual user ID from auth.users
UPDATE notes SET user_id = 'YOUR_USER_ID_HERE' WHERE user_id IS NULL;
```

4. Make the column NOT NULL:
```sql
ALTER TABLE notes ALTER COLUMN user_id SET NOT NULL;
```

5. Update RLS policies:
```sql
-- Drop old policy
DROP POLICY IF EXISTS "Enable all access for notes" ON notes;

-- Create new policies
CREATE POLICY "Users can view own notes" ON notes
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON notes
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON notes
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON notes
FOR DELETE USING (auth.uid() = user_id);
```

## 2. Configure Supabase Auth Settings

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Settings**
3. Configure the following:

### Email Settings
- **Enable Email Provider**: ON
- **Confirm Email**: OFF (for development) or ON (for production)
- **Secure Email Change**: ON (recommended)

### Site URL
- Set your Site URL to: `http://localhost:3000` (for development)
- For production, set it to your actual domain

### Redirect URLs
Add these URLs to the allowed list:
- `http://localhost:3000`
- `http://localhost:3000/auth.html`

## 3. Test the Application

1. Build and start the server:
```bash
npm run build
npm start
```

2. Navigate to `http://localhost:3000`

3. You should be redirected to `/auth.html`

4. Create a new account:
   - Click "Sign Up"
   - Enter your email and password (minimum 6 characters)
   - If email confirmation is disabled, you'll be logged in immediately
   - If email confirmation is enabled, check your email and click the confirmation link

5. After logging in, you should see:
   - Your email address in the top bar
   - The notepad interface
   - A "Logout" button

## 4. Features

### Authentication
- **Sign Up**: Create a new account with email and password
- **Sign In**: Log in to access your notes
- **Sign Out**: Log out from any page
- **Auto-redirect**: Unauthenticated users are redirected to login
- **Session Management**: Authentication tokens are stored in localStorage

### Security
- **Row Level Security (RLS)**: Users can only access their own notes
- **Token-based Auth**: All API requests require a valid JWT token
- **Automatic Logout**: Invalid or expired tokens trigger automatic logout

## 5. API Endpoints

### Authentication Endpoints
- `POST /api/auth/signup` - Create a new account
- `POST /api/auth/signin` - Sign in with email/password
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/user` - Get current user info

### Notes Endpoints (All require authentication)
- `GET /api/notes` - Get all notes for authenticated user
- `GET /api/notes/:id` - Get a specific note
- `POST /api/notes` - Create a new note
- `PUT /api/notes/:id` - Update a note
- `DELETE /api/notes/:id` - Delete a note

All notes endpoints automatically filter by the authenticated user's ID.

## 6. Troubleshooting

### "Invalid or expired token"
- Clear your browser's localStorage and log in again
- Check that your Supabase credentials are correct in `.env`

### "Failed to sign up"
- Check that email confirmation settings match your setup
- Verify your email is valid
- Ensure password is at least 6 characters

### "Failed to fetch notes"
- Verify RLS policies are set up correctly
- Check that you're logged in
- Verify the user_id column exists in the notes table

### Notes not appearing after migration
- Verify all existing notes have a valid user_id
- Check RLS policies are correct
- Confirm you're logged in as the user who owns the notes

## 7. Production Deployment

Before deploying to production:

1. Enable email confirmation in Supabase Auth settings
2. Set up a proper email provider (not Supabase's default)
3. Update Site URL and Redirect URLs to your production domain
4. Use environment variables for sensitive data
5. Enable HTTPS
6. Consider adding rate limiting
7. Set up proper backup procedures

## 8. Next Steps

Consider adding:
- Password reset functionality
- OAuth providers (Google, GitHub, etc.)
- Email verification reminders
- Session timeout warnings
- Remember me functionality
- Profile management
