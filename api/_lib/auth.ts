import type { User } from '@supabase/supabase-js';
import { HttpError, type ApiRequest } from './http.js';
import { getAdmin } from './supabaseAdmin.js';

/** Verifies the Supabase access token in the Authorization header belongs to a teacher. */
export async function requireTeacher(req: ApiRequest): Promise<User> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) throw new HttpError(401, 'Please sign in to the Teacher portal first.', 'UNAUTHENTICATED');

  const admin = getAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.', 'UNAUTHENTICATED');

  const { data: teacher } = await admin.from('teachers').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (!teacher) throw new HttpError(403, 'This account is not registered as a teacher.', 'NOT_TEACHER');
  return data.user;
}
