import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function verifyExamId(examId: string) {
  const { data: candidate, error: candErr } = await supabase
    .from('candidates')
    .select('*')
    .eq('candidate_id', examId.trim().toUpperCase())
    .single();

  if (candErr || !candidate) {
    return { status: 'INVALID', message: 'Invalid Exam ID. Please check your credentials.' };
  }

  const { data: assignment, error: assignErr } = await supabase
    .from('candidate_exams')
    .select('*, exams(*)')
    .eq('candidate_id', candidate.id)
    .single();

  if (assignErr || !assignment) {
    return { status: 'NO_EXAM', message: 'No scheduled exam found for this Candidate ID.' };
  }

  if (assignment.is_completed) {
    return { status: 'ALREADY_USED', message: 'This Exam ID has already been used and submitted.' };
  }

  return {
    status: 'VALID',
    candidate,
    exam: assignment.exams,
  };
}

export async function fetchExamQuestions(examId: string) {
  const { data, error } = await supabase
    .from('questions')
    .select('*, options(*)')
    .eq('exam_id', examId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return data;
}

// Server-Enforced Explanation Usage Limit Checking
export async function checkAndUpdateExplanationLimit(candidateId: string, questionId: string, maxAllowed: number = 3) {
  const { data, error } = await supabase
    .from('question_explanation_usage')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('question_id', questionId)
    .maybeSingle();

  if (data && data.usage_count >= maxAllowed) {
    return { allowed: false, remaining: 0 };
  }

  const currentCount = data ? data.usage_count + 1 : 1;

  if (data) {
    await supabase
      .from('question_explanation_usage')
      .update({ usage_count: currentCount, last_used_at: new Date().toISOString() })
      .eq('id', data.id);
  } else {
    await supabase.from('question_explanation_usage').insert({
      candidate_id: candidateId,
      question_id: questionId,
      usage_count: 1,
      maximum_allowed: maxAllowed,
    });
  }

  return { allowed: true, remaining: maxAllowed - currentCount };
}