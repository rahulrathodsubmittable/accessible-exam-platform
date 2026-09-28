import { isAiConfigured } from './_lib/ai.js';
import { sendJson, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { getAdmin } from './_lib/supabaseAdmin.js';

// GET /api/health — shows which settings this deployment can see (never their values)
// and whether the database is reachable. Useful after changing environment variables.
export default async function handler(_req: ApiRequest, res: ApiResponse): Promise<void> {
  const env = {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
    OPENAI_API_KEY: isAiConfigured(),
  };

  let database = 'not checked';
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
    const { error } = await getAdmin().from('exams').select('id', { count: 'exact', head: true });
    database = error ? `error: ${error.message}` : 'connected';
  }

  sendJson(res, 200, { ok: database === 'connected', env, database, deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local' });
}
