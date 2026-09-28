import type {
  AnswerInput,
  ApiErrorBody,
  BarrierEventType,
  ExamSession,
  ExplanationResult,
  OcrResult,
  PaperAnalysis,
  PerformanceAnalysis,
  PracticeExplanation,
  SubmitResult,
  VerifyResult,
} from '../types';
import { getAccessToken } from './supabase/client';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server. Please check your internet connection.', 0, 'NETWORK');
  }
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok || data === null) {
    throw new ApiError(data?.error ?? `The server could not complete the request (${res.status}).`, res.status, data?.code);
  }
  return data;
}

export const serverApi = {
  verifyCandidate: (candidateCode: string) => post<VerifyResult>('verify-exam-id', { candidateCode }),

  startExam: (candidateCode: string) => post<ExamSession>('start-exam', { candidateCode }),

  saveAnswer: (attemptId: string, answer: AnswerInput) => post<{ saved: boolean }>('save-answer', { attemptId, ...answer }),

  submitExam: (attemptId: string, answers: AnswerInput[]) => post<SubmitResult>('submit-exam', { attemptId, answers }),

  requestExplanation: (attemptId: string, questionId: string) =>
    post<ExplanationResult>('request-explanation', { attemptId, questionId }),

  /** Best effort: barrier analytics must never interrupt an exam. */
  logBarrier: (attemptId: string, eventType: BarrierEventType, questionId?: string, details?: Record<string, unknown>) =>
    post('log-barrier', { attemptId, eventType, questionId, details }).catch(() => undefined),

  performanceAnalysis: (attemptId: string) => post<PerformanceAnalysis>('ai-performance-analysis', { attemptId }),

  practiceExplain: (questionId: string, selectedOptionIndex: number | null) =>
    post<PracticeExplanation>('practice-explain', { questionId, selectedOptionIndex }),

  improvePaper: async (text: string) => post<PaperAnalysis>('ai-paper-improve', { text }, await getAccessToken()),

  processOcr: async (title: string, imageDataUrl: string) =>
    post<OcrResult>('process-ocr', { title, imageDataUrl }, await getAccessToken()),
};
