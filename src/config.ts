import { config } from 'dotenv';

config();

export const CONFIG = {
  PORT: process.env.PORT || 3000,
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
};

// Validate required environment variables
if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(1);
}
