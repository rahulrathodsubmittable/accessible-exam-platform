import type { ExplanationResult } from '../shared/types.js';
import { chat, isAiConfigured } from './_lib/ai.js';
import { assertAttemptOpen, loadAttempt, loadQuestions } from './_lib/exam.js';
import { check, HttpError, postHandler, requireUuid } from './_lib/http.js';
import { getAdmin } from './_lib/supabaseAdmin.js';

// Exam-mode explanation: clarifies the question without revealing the answer.
// The per-question limit is enforced atomically in Postgres (consume_explanation).
export default postHandler(async (body): Promise<ExplanationResult> => {
  const { attempt, exam } = await loadAttempt(requireUuid(body, 'attemptId'));
  assertAttemptOpen(attempt, exam);
  if (!exam.allow_ai_explanations_in_exam) {
    throw new HttpError(403, 'Explanations are turned off for this formal examination.', 'DISABLED');
  }
  if (!isAiConfigured()) {
    throw new HttpError(503, 'AI explanations are not available on this server right now.', 'AI_NOT_CONFIGURED');
  }

  const questionId = requireUuid(body, 'questionId');
  const question = (await loadQuestions(exam.id)).find((q) => q.id === questionId);
  if (!question) throw new HttpError(400, 'That question is not part of this exam.');

  const admin = getAdmin();
  const maxAllowed = exam.max_question_explanations;
  const usage = check(
    await admin
      .from('question_explanation_usage')
      .select('usage_count')
      .eq('candidate_id', attempt.candidate_id)
      .eq('question_id', questionId)
      .eq('attempt_id', attempt.id)
      .maybeSingle(),
  ) as { usage_count: number } | null;

  const limitMessage = `You have used all ${maxAllowed} explanations for this question.`;
  if ((usage?.usage_count ?? 0) >= maxAllowed) throw new HttpError(429, limitMessage, 'LIMIT_REACHED');

  const explanation = await chat(
    [
      {
        role: 'system',
        content:
          'You help visually impaired students during a formal exam. Clarify what the question is asking, define key terms, ' +
          'and describe any visual content in plain spoken language. Never reveal, hint at, rule out, or rank any answer option. ' +
          'Use short sentences that read well through a screen reader. No markdown, no tables, under 150 words.',
      },
      {
        role: 'user',
        content:
          `Question: ${question.question_text}\n` +
          `Options: ${question.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('; ')}\n` +
          (question.visual_description ? `Visual content: ${question.visual_description}\n` : '') +
          'Explain what is being asked without helping choose an option.',
      },
    ],
    { maxTokens: 350 },
  );

  // Consume only after a successful explanation, so AI failures don't cost the student a use.
  const [consumed] = check(
    await admin.rpc('consume_explanation', {
      p_candidate_id: attempt.candidate_id,
      p_question_id: questionId,
      p_attempt_id: attempt.id,
      p_max_allowed: maxAllowed,
    }),
  ) as { allowed: boolean; used_count: number; remaining: number }[];

  if (!consumed?.allowed) throw new HttpError(429, limitMessage, 'LIMIT_REACHED');
  return { explanation, usedCount: consumed.used_count, remaining: consumed.remaining, maxAllowed };
});
