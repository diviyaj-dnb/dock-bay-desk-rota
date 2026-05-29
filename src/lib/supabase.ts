import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in your project URL + anon key.',
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // PKCE is the most reliable OAuth flow for mobile browsers — the redirect
    // back from Google carries a `?code=` that's exchanged for a session,
    // rather than a URL hash that mobile Safari can drop.
    flowType: 'pkce',
    // Pick up the session from the redirect URL on return from Google.
    detectSessionInUrl: true,
  },
});
