import { scoreAttempt } from '../../shared/scoring.js';
import { CANDIDATE_CODE_PATTERN, normalizeCandidateCode } from '../../shared/candidateCode.js';
import type { AnswerInput, ExamSummary, SubmitResult } from '../../shared/types.js';
import { check, HttpError } from './http.js';
import { getAdmin } from './supabaseAdmin.js';

export interface ExamRow {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  duration_minutes: number;
  scheduled_start: string;
  scheduled_end: string;
  is_published: boolean;
  max_question_explanations: number;
  allow_ai_explanations_in_exam: boolean;
}

export interface CandidateRow {
  id: string;
  candidate_code: string;
  full_name: string;
  is_active: boolean;
  assigned_exam_id: string | null;
}

export interface AttemptRow {
  id: string;
  candidate_id: string;
  exam_id: string;
  started_at: string;
  submitted_at: string | null;
  status: 'in_progress' | 'submitted';
  score: number | string | null;
  total_marks: number | null;
  total_questions: number;
  correct_count: number;
  answered_count: number;
  skipped_count: number;
  marked_count: number;
}

export interface QuestionRow {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation: string | null;
  visual_description: string | null;
  has_visual_content: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string | null;
  marks: number;
  order_index: number;
}

interface AnswerRow {
  question_id: string;
  selected_option_index: number | null;
  is_skipped: boolean;
  is_marked_for_review: boolean;
}

/** Answers arriving slightly after the deadline (network latency) are still accepted. */
export const SUBMIT_GRACE_MS = 60_000;

export function attemptDeadline(attempt: Pick<AttemptRow, 'started_at'>, exam: ExamRow): Date {
  const byDuration = new Date(attempt.started_at).getTime() + exam.duration_minutes * 60_000;
  return new Date(Math.min(byDuration, new Date(exam.scheduled_end).getTime()));
}

export function toExamSummary(exam: ExamRow, questionCount: number): ExamSummary {
  return {
    id: exam.id,
    title: exam.title,
    subject: exam.subject,
    description: exam.description,
    durationMinutes: exam.duration_minutes,
    maxExplanations: exam.max_question_explanations,
    allowAiInExam: exam.allow_ai_explanations_in_exam,
    questionCount,
  };
}

export function toAnswerInput(row: AnswerRow): AnswerInput {
  return {
    questionId: row.question_id,
    selectedOptionIndex: row.selected_option_index,
    isSkipped: row.is_skipped,
    isMarked: row.is_marked_for_review,
  };
}

/**
 * Looks up a Candidate ID and checks it can sit its assigned exam right now.
 * Shared by verify-exam-id and start-exam so both apply identical rules.
 */
export async function loadEligibleCandidate(rawCode: string) {
  const code = normalizeCandidateCode(rawCode);
  if (!CANDIDATE_CODE_PATTERN.test(code)) {
    throw new HttpError(400, 'Candidate IDs look like EXM-2026-A7K92. Please check and try again.', 'INVALID');
  }

  const admin = getAdmin();
  const candidate = check(
    await admin
      .from('candidates')
      .select('id, candidate_code, full_name, is_active, assigned_exam_id, exams(*)')
      .eq('candidate_code', code)
      .maybeSingle(),
  ) as (CandidateRow & { exams: ExamRow | null }) | null;

  if (!candidate) throw new HttpError(404, 'That Candidate ID was not found. Please check and try again.', 'INVALID');
  if (!candidate.is_active) throw new HttpError(403, 'This Candidate ID has been deactivated. Please contact your exam coordinator.', 'DEACTIVATED');

  const exam = candidate.exams;
  if (!exam || !exam.is_published) {
    throw new HttpError(404, 'No published examination is assigned to this Candidate ID yet.', 'NO_EXAM');
  }

  const now = Date.now();
  if (now < new Date(exam.scheduled_start).getTime()) {
    const start = new Date(exam.scheduled_start).toUTCString();
    throw new HttpError(409, `Your examination has not started yet. It opens at ${start}.`, 'NOT_STARTED');
  }

  const attempt = check(
    await admin.from('attempts').select('*').eq('candidate_id', candidate.id).eq('exam_id', exam.id).maybeSingle(),
  ) as AttemptRow | null;

  if (attempt?.status === 'submitted') {
    throw new HttpError(409, 'This Candidate ID has already been used and the exam was submitted.', 'ALREADY_USED');
  }

  if (attempt && now > attemptDeadline(attempt, exam).getTime() + SUBMIT_GRACE_MS) {
    await finalizeAttempt(attempt, exam, []);
    throw new HttpError(409, 'Your exam time has ended. Your saved answers have been submitted.', 'ALREADY_USED');
  }

  if (!attempt && now > new Date(exam.scheduled_end).getTime()) {
    throw new HttpError(409, 'The window for this examination has closed.', 'EXPIRED');
  }

  return { candidate, exam, attempt };
}

/** Loads an attempt with its exam, or throws 404. */
export async function loadAttempt(attemptId: string): Promise<{ attempt: AttemptRow; exam: ExamRow }> {
  const row = check(
    await getAdmin().from('attempts').select('*, exams(*)').eq('id', attemptId).maybeSingle(),
  ) as (AttemptRow & { exams: ExamRow }) | null;
  if (!row) throw new HttpError(404, 'This exam session was not found.', 'NO_ATTEMPT');
  const { exams, ...attempt } = row;
  return { attempt, exam: exams };
}

/** Throws unless the attempt is still in progress and within its time limit. */
export function assertAttemptOpen(attempt: AttemptRow, exam: ExamRow): void {
  if (attempt.status !== 'in_progress') throw new HttpError(409, 'This exam has already been submitted.', 'ALREADY_SUBMITTED');
  if (Date.now() > attemptDeadline(attempt, exam).getTime() + SUBMIT_GRACE_MS) {
    throw new HttpError(409, 'The time for this exam has ended.', 'TIME_UP');
  }
}

export async function loadQuestions(examId: string): Promise<QuestionRow[]> {
  return check(
    await getAdmin().from('questions').select('*').eq('exam_id', examId).order('order_index', { ascending: true }),
  ) as QuestionRow[];
}

export async function loadAnswers(attemptId: string): Promise<AnswerInput[]> {
  const rows = check(
    await getAdmin()
      .from('answers')
      .select('question_id, selected_option_index, is_skipped, is_marked_for_review')
      .eq('attempt_id', attemptId),
  ) as AnswerRow[];
  return rows.map(toAnswerInput);
}

/** Validates answers against the exam's questions and upserts them. */
export async function upsertAnswers(attemptId: string, questions: QuestionRow[], answers: AnswerInput[]): Promise<void> {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const rows = answers
    .filter((a) => byId.has(a.questionId))
    .map((a) => {
      const optionCount = byId.get(a.questionId)!.options.length;
      const selected = a.selectedOptionIndex !== null && a.selectedOptionIndex < optionCount ? a.selectedOptionIndex : null;
      return {
        attempt_id: attemptId,
        question_id: a.questionId,
        selected_option_index: selected,
        is_skipped: selected === null && a.isSkipped,
        is_marked_for_review: a.isMarked,
        updated_at: new Date().toISOString(),
      };
    });
  if (rows.length === 0) return;
  check(await getAdmin().from('answers').upsert(rows, { onConflict: 'attempt_id,question_id' }));
}

export function storedResult(attempt: AttemptRow): SubmitResult {
  return {
    score: Number(attempt.score ?? 0),
    totalMarks: attempt.total_marks ?? 0,
    totalQuestions: attempt.total_questions,
    correctCount: attempt.correct_count,
    answeredCount: attempt.answered_count,
    skippedCount: attempt.skipped_count,
    markedCount: attempt.marked_count,
  };
}

/** Saves any final answers, scores the attempt server-side and marks it submitted. */
export async function finalizeAttempt(attempt: AttemptRow, exam: ExamRow, finalAnswers: AnswerInput[]): Promise<SubmitResult> {
  const questions = await loadQuestions(exam.id);
  await upsertAnswers(attempt.id, questions, finalAnswers);
  const answers = await loadAnswers(attempt.id);

  const result = scoreAttempt(
    questions.map((q) => ({ id: q.id, correctOptionIndex: q.correct_option_index, marks: q.marks, topic: q.topic })),
    answers,
  );

  const updated = check(
    await getAdmin()
      .from('attempts')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        score: result.score,
        total_marks: result.totalMarks,
        total_questions: result.totalQuestions,
        correct_count: result.correctCount,
        answered_count: result.answeredCount,
        skipped_count: result.skippedCount,
        marked_count: result.markedCount,
      })
      .eq('id', attempt.id)
      .eq('status', 'in_progress')
      .select('*'),
  ) as AttemptRow[];

  // Another request submitted first; report what it stored.
  if (updated.length === 0) {
    const { attempt: latest } = await loadAttempt(attempt.id);
    return storedResult(latest);
  }

  return storedResult(updated[0]);
}
