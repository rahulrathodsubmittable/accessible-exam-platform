import React, { useCallback, useEffect, useState } from 'react';
import { generateCandidateCode } from '../../../shared/candidateCode';
import { supabase } from '../../services/supabase/client';
import { dangerButton, inputClass, labelClass, primaryButton, secondaryButton, useTeacherExams } from './useTeacherExams';

interface CandidateRow {
  id: string;
  candidate_code: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  attempts: { id: string; exam_id: string; status: string; score: number | null; total_marks: number | null }[];
}

function newCode() {
  return generateCandidateCode(new Date().getFullYear(), crypto.getRandomValues(new Uint32Array(5)));
}

export const CandidateIdGenerator: React.FC = () => {
  const { exams } = useTeacherExams();
  const [examId, setExamId] = useState('');
  const [names, setNames] = useState('');
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!examId && exams[0]) setExamId(exams[0].id);
  }, [exams, examId]);

  const load = useCallback(async () => {
    if (!supabase || !examId) return;
    const { data, error } = await supabase
      .from('candidates')
      .select('id, candidate_code, full_name, email, is_active, attempts(id, exam_id, status, score, total_marks)')
      .eq('assigned_exam_id', examId)
      .order('created_at');
    if (error) setMessage(error.message);
    else setCandidates((data ?? []) as CandidateRow[]);
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !examId) return;
    const list = names
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (list.length === 0) {
      setMessage('Enter at least one candidate name.');
      return;
    }
    setBusy(true);
    const rows = () =>
      list.map((line) => {
        const [fullName, email] = line.split(',').map((s) => s.trim());
        return { candidate_code: newCode(), full_name: fullName, email: email || null, assigned_exam_id: examId };
      });
    let { error } = await supabase.from('candidates').insert(rows());
    // A random ID collision is very unlikely; retry once with fresh IDs.
    if (error?.code === '23505') ({ error } = await supabase.from('candidates').insert(rows()));
    setBusy(false);
    if (error) {
      setMessage(`Could not create candidates: ${error.message}`);
      return;
    }
    setMessage(`Created ${list.length} Candidate ID${list.length === 1 ? '' : 's'}.`);
    setNames('');
    void load();
  };

  const toggleActive = async (c: CandidateRow) => {
    if (!supabase) return;
    const { error } = await supabase.from('candidates').update({ is_active: !c.is_active }).eq('id', c.id);
    setMessage(error ? error.message : `${c.candidate_code} ${c.is_active ? 'deactivated' : 'activated'}.`);
    void load();
  };

  const resetAttempt = async (c: CandidateRow) => {
    if (!supabase || !window.confirm(`Reset ${c.full_name}'s attempt? Their answers will be deleted and the ID can be used again.`)) return;
    const { error } = await supabase.from('attempts').delete().eq('candidate_id', c.id).eq('exam_id', examId);
    setMessage(error ? error.message : `${c.candidate_code} reset.`);
    void load();
  };

  const copyAll = async () => {
    const text = candidates.map((c) => `${c.candidate_code}\t${c.full_name}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Candidate IDs copied to the clipboard.');
    } catch {
      setMessage('Could not access the clipboard.');
    }
  };

  if (exams.length === 0) return <p className="text-lg">Create an exam first, then generate Candidate IDs for it.</p>;

  return (
    <div className="space-y-6">
      {message && (
        <p role="status" className="text-lg bg-slate-800 border-2 border-slate-600 p-3 rounded-lg">
          {message}
        </p>
      )}
      <div>
        <label htmlFor="cand-exam" className={labelClass}>Exam</label>
        <select id="cand-exam" value={examId} onChange={(e) => setExamId(e.target.value)} className={inputClass}>
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.title}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={generate} className="bg-slate-900 border-2 border-slate-700 rounded-xl p-6 space-y-3">
        <h2 className="text-2xl font-bold">Generate Candidate IDs</h2>
        <label htmlFor="cand-names" className={labelClass}>
          One candidate per line: <em>Full name, email (optional)</em>
        </label>
        <textarea
          id="cand-names"
          rows={5}
          value={names}
          onChange={(e) => setNames(e.target.value)}
          placeholder={'Aarav Sharma, aarav@example.com\nPriya Patel'}
          className={inputClass}
        />
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? 'Generating…' : 'Generate IDs'}
        </button>
      </form>

      <section aria-labelledby="cand-list" className="space-y-3">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <h2 id="cand-list" className="text-2xl font-bold">
            Candidates ({candidates.length})
          </h2>
          {candidates.length > 0 && (
            <button onClick={() => void copyAll()} className={secondaryButton}>
              Copy all IDs
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-lg border-collapse">
            <caption className="sr-only">Candidates assigned to the selected exam</caption>
            <thead>
              <tr className="border-b-2 border-slate-600">
                <th scope="col" className="p-2">Candidate ID</th>
                <th scope="col" className="p-2">Name</th>
                <th scope="col" className="p-2">Status</th>
                <th scope="col" className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const attempt = c.attempts.find((a) => a.exam_id === examId);
                const status = !c.is_active
                  ? 'Deactivated'
                  : !attempt
                    ? 'Not started'
                    : attempt.status === 'submitted'
                      ? `Submitted — ${attempt.score ?? 0}/${attempt.total_marks ?? 0}`
                      : 'In progress';
                return (
                  <tr key={c.id} className="border-b border-slate-700">
                    <td className="p-2 font-mono font-bold text-yellow-300">{c.candidate_code}</td>
                    <td className="p-2">{c.full_name}</td>
                    <td className="p-2">{status}</td>
                    <td className="p-2 flex flex-wrap gap-2">
                      <button onClick={() => void toggleActive(c)} className={secondaryButton}>
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      {attempt && (
                        <button onClick={() => void resetAttempt(c)} className={dangerButton}>
                          Reset attempt
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
