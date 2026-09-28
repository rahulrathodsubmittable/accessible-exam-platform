import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http.js';

let client: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS, so it must only ever run server-side. */
export function getAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // New-style secret keys (sb_secret_…) and legacy service_role keys both work.
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new HttpError(
      503,
      'The server is not connected to Supabase yet. Set SUPABASE_URL and SUPABASE_SECRET_KEY.',
      'NOT_CONFIGURED',
    );
  }
  client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
