import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase/client';

export interface TeacherExam {
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
  questions: { count: number }[];
}

/** Loads all exams (RLS limits this to signed-in teachers). */
export function useTeacherExams() {
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('exams')
      .select('*, questions(count)')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (err) setError(err.message);
    else {
      setError(null);
      setExams((data ?? []) as TeacherExam[]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { exams, loading, error, reload };
}

export const inputClass = 'w-full bg-slate-950 border-2 border-slate-600 rounded-lg p-3 text-lg focus:border-yellow-400';
export const labelClass = 'block text-lg font-semibold mb-1';
export const primaryButton = 'px-5 py-3 bg-yellow-400 text-black font-black rounded-lg disabled:opacity-60 focus:ring-4 focus:ring-white';
export const secondaryButton = 'px-4 py-2 bg-slate-700 border-2 border-slate-500 font-bold rounded-lg disabled:opacity-60';
export const dangerButton = 'px-4 py-2 bg-red-700 border-2 border-red-400 font-bold rounded-lg disabled:opacity-60';
