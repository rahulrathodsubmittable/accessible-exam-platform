import { assertAttemptOpen, loadAttempt, loadQuestions, upsertAnswers } from './_lib/exam.js';
import { HttpError, optionalBoolean, optionalIndex, postHandler, requireUuid } from './_lib/http.js';

// Auto-saves one answer while the exam is in progress.
export default postHandler(async (body) => {
  const { attempt, exam } = await loadAttempt(requireUuid(body, 'attemptId'));
  assertAttemptOpen(attempt, exam);

  const questionId = requireUuid(body, 'questionId');
  const questions = await loadQuestions(exam.id);
  if (!questions.some((q) => q.id === questionId)) throw new HttpError(400, 'That question is not part of this exam.');

  await upsertAnswers(attempt.id, questions, [
    {
      questionId,
      selectedOptionIndex: optionalIndex(body, 'selectedOptionIndex'),
      isSkipped: optionalBoolean(body, 'isSkipped'),
      isMarked: optionalBoolean(body, 'isMarked'),
    },
  ]);
  return { saved: true };
});
