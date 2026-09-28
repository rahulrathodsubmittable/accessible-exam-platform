import type { ExamSession } from '../shared/types.js';
import {
  attemptDeadline,
  loadAnswers,
  loadEligibleCandidate,
  loadQuestions,
  toExamSummary,
  type AttemptRow,
} from './_lib/exam.js';
import { check, HttpError, postHandler, requireString } from './_lib/http.js';
import { getAdmin } from './_lib/supabaseAdmin.js';

// Starts (or resumes) the candidate's single attempt and returns the questions
// without correct answers or explanations.
export default postHandler(async (body): Promise<ExamSession> => {
  const { candidate, exam, attempt: existing } = await loadEligibleCandidate(requireString(body, 'candidateCode', 40));
  const questions = await loadQuestions(exam.id);
  if (questions.length === 0) throw new HttpError(409, 'This exam has no questions yet. Please contact your exam coordinator.', 'NO_QUESTIONS');

  const admin = getAdmin();
  let attempt = existing;
  if (!attempt) {
    const inserted = await admin
      .from('attempts')
      .insert({ candidate_id: candidate.id, exam_id: exam.id, total_questions: questions.length })
      .select('*')
      .single();
    if (inserted.error?.code === '23505') {
      // Started concurrently in another tab; resume that attempt.
      attempt = check(
        await admin.from('attempts').select('*').eq('candidate_id', candidate.id).eq('exam_id', exam.id).single(),
      ) as AttemptRow;
    } else {
      attempt = check(inserted) as AttemptRow;
    }
  }

  return {
    candidate: { id: candidate.id, fullName: candidate.full_name, candidateCode: candidate.candidate_code },
    exam: toExamSummary(exam, questions.length),
    attempt: {
      id: attempt.id,
      startedAt: attempt.started_at,
      deadline: attemptDeadline(attempt, exam).toISOString(),
    },
    serverTime: new Date().toISOString(),
    questions: questions.map((q) => ({
      id: q.id,
      questionText: q.question_text,
      options: q.options,
      visualDescription: q.visual_description,
      hasVisualContent: q.has_visual_content || Boolean(q.visual_description),
      topic: q.topic,
      difficulty: q.difficulty,
      marks: q.marks,
    })),
    savedAnswers: await loadAnswers(attempt.id),
  };
});
