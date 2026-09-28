import { BARRIER_EVENT_TYPES, type BarrierEventType } from '../shared/types.js';
import { loadAttempt } from './_lib/exam.js';
import { check, HttpError, postHandler, requireUuid } from './_lib/http.js';
import { getAdmin } from './_lib/supabaseAdmin.js';

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

// Records an accessibility barrier signal (repeated reads, long pauses, voice errors, skip spikes).
export default postHandler(async (body) => {
  const { attempt } = await loadAttempt(requireUuid(body, 'attemptId'));
  if (attempt.status !== 'in_progress') return { logged: false };

  const eventType = body.eventType as BarrierEventType;
  if (!BARRIER_EVENT_TYPES.includes(eventType)) throw new HttpError(400, 'Unknown barrier event type.');

  const questionId = typeof body.questionId === 'string' && UUID_PATTERN.test(body.questionId) ? body.questionId : null;
  const details = body.details && typeof body.details === 'object' ? body.details : null;
  if (details && JSON.stringify(details).length > 2000) throw new HttpError(413, 'Event details are too large.');

  check(
    await getAdmin().from('barrier_events').insert({
      attempt_id: attempt.id,
      exam_id: attempt.exam_id,
      question_id: questionId,
      event_type: eventType,
      details,
    }),
  );
  return { logged: true };
});
