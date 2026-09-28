// Types shared by the frontend (src/) and the Vercel functions (api/).

export type Difficulty = 'easy' | 'medium' | 'hard';

export type BarrierEventType = 'repeated_read' | 'nav_delay' | 'voice_error' | 'skip_spike';

export const BARRIER_EVENT_TYPES: readonly BarrierEventType[] = [
  'repeated_read',
  'nav_delay',
  'voice_error',
  'skip_spike',
];

export interface CandidateSummary {
  id: string;
  fullName: string;
  candidateCode: string;
}

export interface ExamSummary {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  durationMinutes: number;
  maxExplanations: number;
  allowAiInExam: boolean;
  questionCount: number;
}

/** Response of POST /api/verify-exam-id */
export interface VerifyResult {
  candidate: CandidateSummary;
  exam: ExamSummary;
  hasAttemptInProgress: boolean;
}

/** A question as sent to candidates: never includes the correct answer. */
export interface PublicQuestion {
  id: string;
  questionText: string;
  options: string[];
  visualDescription: string | null;
  hasVisualContent: boolean;
  topic: string | null;
  difficulty: Difficulty;
  marks: number;
}

export interface AnswerInput {
  questionId: string;
  selectedOptionIndex: number | null;
  isSkipped: boolean;
  isMarked: boolean;
}

/** Response of POST /api/start-exam */
export interface ExamSession {
  candidate: CandidateSummary;
  exam: ExamSummary;
  attempt: {
    id: string;
    startedAt: string;
    deadline: string;
  };
  serverTime: string;
  questions: PublicQuestion[];
  savedAnswers: AnswerInput[];
}

export interface SubmitResult {
  score: number;
  totalMarks: number;
  totalQuestions: number;
  correctCount: number;
  answeredCount: number;
  skippedCount: number;
  markedCount: number;
}

export interface ExplanationResult {
  explanation: string;
  usedCount: number;
  remaining: number;
  maxAllowed: number;
}

export interface PerformanceAnalysis {
  weakTopics: string[];
  strongTopics: string[];
  learningBarriers: string[];
  recommendedPractice: string[];
  overallSummary: string;
  aiGenerated: boolean;
}

export interface PracticeExplanation {
  explanation: string;
  aiGenerated: boolean;
}

export interface PaperAnalysis {
  claritySuggestions: string[];
  visualDescriptionFixes: string[];
  difficultyNotes: string[];
  rewrittenQuestions: string[];
}

export interface OcrResult {
  documentId: string | null;
  extractedText: string;
  accessibleDescription: string;
  detectedQuestions: string[];
}

export interface ApiErrorBody {
  error: string;
  code?: string;
}
