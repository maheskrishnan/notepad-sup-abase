# Database Migrations

This folder contains all database migration scripts for the Notepad application.

## Migration Order

Run these migrations in order in your Supabase SQL Editor:

### 1. `001_initial_schema.sql`
- Creates the `notes` table with all required columns
- Creates indexes on `updated_at` and `user_id`
- Sets up trigger to auto-update `updated_at` timestamp
- Enables Row Level Security (RLS)
- Creates RLS policies for authenticated users

### 2. `002_add_user_authentication.sql`
- Adds `user_id` column to existing notes table (if needed)
- Creates index on `user_id`
- Updates RLS policies for user-specific access

**Note:** This migration is only needed if you're migrating from an existing database without authentication. If you're starting fresh, migration 001 already includes this.

### 3. `003_add_soft_delete.sql`
- Adds `is_deleted` boolean column for soft delete functionality
- Sets default value to `FALSE` for all existing notes

### 4. `004_add_soft_delete_index.sql`
- Adds composite index for optimized soft delete queries
- Covers the pattern: `WHERE user_id = ? AND is_deleted = ? ORDER BY updated_at DESC`
- Significantly improves performance for listing active notes

## Usage

To apply a migration:

1. Log into your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file
4. Paste and execute in the SQL Editor
5. Verify the migration completed successfully

## Verification

After running migrations, you can verify the schema using the verification script in `scripts/check-schema.sql`.
