import type { AnswerInput, SubmitResult } from '../shared/types.js';
import { attemptDeadline, finalizeAttempt, loadAttempt, storedResult, SUBMIT_GRACE_MS } from './_lib/exam.js';
import { HttpError, postHandler, requireUuid } from './_lib/http.js';

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

function parseAnswers(value: unknown): AnswerInput[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 500) throw new HttpError(400, '"answers" must be a list.');
  return value.flatMap((item): AnswerInput[] => {
    if (!item || typeof item !== 'object') return [];
    const a = item as Record<string, unknown>;
    if (typeof a.questionId !== 'string' || !UUID_PATTERN.test(a.questionId)) return [];
    const selected = a.selectedOptionIndex;
    return [
      {
        questionId: a.questionId,
        selectedOptionIndex: typeof selected === 'number' && Number.isInteger(selected) && selected >= 0 ? selected : null,
        isSkipped: a.isSkipped === true,
        isMarked: a.isMarked === true,
      },
    ];
  });
}

// Scores the exam on the server. Safe to call twice (returns the stored result).
export default postHandler(async (body): Promise<SubmitResult> => {
  const { attempt, exam } = await loadAttempt(requireUuid(body, 'attemptId'));
  if (attempt.status === 'submitted') return storedResult(attempt);

  // After the deadline only answers already saved on the server count.
  const withinTime = Date.now() <= attemptDeadline(attempt, exam).getTime() + SUBMIT_GRACE_MS;
  return finalizeAttempt(attempt, exam, withinTime ? parseAnswers(body.answers) : []);
});
