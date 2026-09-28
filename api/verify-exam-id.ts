import type { VerifyResult } from '../shared/types.js';
import { loadEligibleCandidate, loadQuestions, toExamSummary } from './_lib/exam.js';
import { postHandler, requireString } from './_lib/http.js';

// Checks a Candidate ID without starting the exam clock.
export default postHandler(async (body): Promise<VerifyResult> => {
  const { candidate, exam, attempt } = await loadEligibleCandidate(requireString(body, 'candidateCode', 40));
  const questions = await loadQuestions(exam.id);
  return {
    candidate: { id: candidate.id, fullName: candidate.full_name, candidateCode: candidate.candidate_code },
    exam: toExamSummary(exam, questions.length),
    hasAttemptInProgress: Boolean(attempt),
  };
});
