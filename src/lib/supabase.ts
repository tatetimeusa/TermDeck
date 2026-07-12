import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// null when the build has no Supabase config — the app then behaves exactly
// like the pre-sync versions (fully local, sign-in UI shows "not configured")
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // the packaged app runs on file:// — never try to parse OAuth
          // fragments out of the window location
          detectSessionInUrl: false,
        },
      })
    : null;
