import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase/client';
import type { BarrierEventType } from '../../types';
import { inputClass, labelClass, useTeacherExams } from './useTeacherExams';

interface EventRow {
  event_type: BarrierEventType;
  question_id: string | null;
  questions: { order_index: number; question_text: string } | null;
}

const LABELS: Record<BarrierEventType, string> = {
  repeated_read: 'Repeated reads',
  nav_delay: 'Long pauses',
  voice_error: 'Voice errors',
  skip_spike: 'Skip streaks',
};
const TYPES = Object.keys(LABELS) as BarrierEventType[];

/** Aggregated accessibility barriers per question. Shows counts only, never who triggered them. */
export const BarrierReplayViewer: React.FC = () => {
  const { exams } = useTeacherExams();
  const [examId, setExamId] = useState('');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId && exams[0]) setExamId(exams[0].id);
  }, [exams, examId]);

  useEffect(() => {
    if (!supabase || !examId) return;
    supabase
      .from('barrier_events')
      .select('event_type, question_id, questions(order_index, question_text)')
      .eq('exam_id', examId)
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else {
          setError(null);
          setEvents((data ?? []) as unknown as EventRow[]);
        }
      });
  }, [examId]);

  const rows = useMemo(() => {
    const byQuestion = new Map<string, { label: string; order: number; counts: Record<BarrierEventType, number> }>();
    for (const e of events) {
      const key = e.question_id ?? 'general';
      const entry = byQuestion.get(key) ?? {
        label: e.questions ? `Q${e.questions.order_index}. ${e.questions.question_text}` : 'Not tied to a question',
        order: e.questions?.order_index ?? Number.MAX_SAFE_INTEGER,
        counts: { repeated_read: 0, nav_delay: 0, voice_error: 0, skip_spike: 0 },
      };
      entry.counts[e.event_type] += 1;
      byQuestion.set(key, entry);
    }
    return [...byQuestion.values()].sort((a, b) => a.order - b.order);
  }, [events]);

  const totals = TYPES.map((t) => ({ type: t, count: events.filter((e) => e.event_type === t).length }));

  if (exams.length === 0) return <p className="text-lg">No exams yet.</p>;

  return (
    <div className="space-y-6">
      <p className="text-lg text-slate-300">
        Where candidates struggled with the exam's presentation: repeated reads, long pauses, voice-recognition errors and skip
        streaks. Personal data is never shown.
      </p>
      <div>
        <label htmlFor="barrier-exam" className={labelClass}>Exam</label>
        <select id="barrier-exam" value={examId} onChange={(e) => setExamId(e.target.value)} className={inputClass}>
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.title}
            </option>
          ))}
        </select>
      </div>
      {error && <p role="alert" className="text-red-300">{error}</p>}

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {totals.map((t) => (
          <div key={t.type} className="bg-slate-900 border-2 border-slate-700 rounded-xl p-4">
            <dt className="text-lg text-slate-300">{LABELS[t.type]}</dt>
            <dd className="text-4xl font-black text-yellow-400">{t.count}</dd>
          </div>
        ))}
      </dl>

      {rows.length === 0 ? (
        <p className="text-lg">No barrier events recorded for this exam yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-lg border-collapse">
            <caption className="text-left text-xl font-bold mb-2">Barrier events by question</caption>
            <thead>
              <tr className="border-b-2 border-slate-600">
                <th scope="col" className="p-2">Question</th>
                {TYPES.map((t) => (
                  <th key={t} scope="col" className="p-2 text-right">
                    {LABELS[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-slate-700">
                  <th scope="row" className="p-2 font-normal max-w-md">{r.label}</th>
                  {TYPES.map((t) => (
                    <td key={t} className={`p-2 text-right font-mono ${r.counts[t] > 0 ? 'text-yellow-300 font-bold' : 'text-slate-300'}`}>
                      {r.counts[t]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
