import { createClient } from '@supabase/supabase-js';

// Only the Teacher portal talks to Supabase directly (as a signed-in teacher,
// protected by RLS). Candidate flows go through the /api functions instead.
const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
// New-style publishable keys (sb_publishable_…) and legacy anon keys both work.
const anonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : null;

export async function getAccessToken(): Promise<string> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.access_token ?? '';
}
