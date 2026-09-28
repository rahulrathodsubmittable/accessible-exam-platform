import { supabase } from '../supabase/client';

export interface BarrierMetrics {
  repeatedReadsCount: number;
  longPausesCount: number;
  voiceRecognitionErrors: number;
  skipRatePercentage: number;
}

export const logBarrierEvent = async (
  candidateId: string,
  attemptId: string,
  questionId: string,
  eventType: 'repeated_read' | 'nav_delay' | 'voice_error' | 'skip_spike',
  details: Record<string, any>
) => {
  try {
    await supabase.from('barrier_events').insert({
      candidate_id: candidateId,
      attempt_id: attemptId,
      question_id: questionId,
      event_type: eventType,
      details,
    });
  } catch (err) {
    console.error('Failed logging barrier event:', err);
  }
};

export const generateAIPerformanceAnalysis = async (attemptId: string) => {
  // Pull attempt details, answers, and barrier events
  const { data: attempt } = await supabase.from('attempts').select('*, answers(*), candidates(*)').eq('id', attemptId).single();
  const { data: barriers } = await supabase.from('barrier_events').select('*').eq('attempt_id', attemptId);

  const prompt = `Analyze this examination performance for a visually impaired student:
  Total Questions: ${attempt.total_questions}
  Score: ${attempt.score}%
  Logged Navigation/Accessibility Barrier Events: ${JSON.stringify(barriers)}
  
  Generate a JSON response with:
  1. weak_topics (array of strings)
  2. learning_barriers (array of identified platform or clarity issues)
  3. recommended_practice (array of recommended study areas)
  4. overall_summary (constructive, supportive text description)`;

  // Call AI Backend endpoint
  const response = await fetch('/api/ai-performance-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, attemptId, candidateId: attempt.candidate_id }),
  });

  return response.json();
};