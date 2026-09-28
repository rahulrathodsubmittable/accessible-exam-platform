import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase/client';
import {
  dangerButton,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
  useTeacherExams,
  type TeacherExam,
} from './useTeacherExams';

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const emptyExam = () => ({
  title: '',
  subject: '',
  description: '',
  duration_minutes: 60,
  scheduled_start: toLocalInput(new Date()),
  scheduled_end: toLocalInput(new Date(Date.now() + 7 * 24 * 3600_000)),
  max_question_explanations: 3,
  allow_ai_explanations_in_exam: false,
});

export const ExamManager: React.FC = () => {
  const { exams, loading, error, reload } = useTeacherExams();
  const [form, setForm] = useState(emptyExam);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openExamId, setOpenExamId] = useState<string | null>(null);

  const createExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setMessage(null);
    const { error: err } = await supabase.from('exams').insert({
      ...form,
      description: form.description || null,
      scheduled_start: new Date(form.scheduled_start).toISOString(),
      scheduled_end: new Date(form.scheduled_end).toISOString(),
    });
    setSaving(false);
    if (err) {
      setMessage(`Could not create exam: ${err.message}`);
      return;
    }
    setMessage('Exam created. Add questions, then publish it.');
    setForm(emptyExam());
    void reload();
  };

  const togglePublish = async (exam: TeacherExam) => {
    if (!supabase) return;
    const { error: err } = await supabase.from('exams').update({ is_published: !exam.is_published }).eq('id', exam.id);
    setMessage(err ? err.message : exam.is_published ? `“${exam.title}” unpublished.` : `“${exam.title}” published.`);
    void reload();
  };

  const deleteExam = async (exam: TeacherExam) => {
    if (!supabase || !window.confirm(`Delete “${exam.title}” and all its questions and attempts? This cannot be undone.`)) return;
    const { error: err } = await supabase.from('exams').delete().eq('id', exam.id);
    setMessage(err ? err.message : `“${exam.title}” deleted.`);
    void reload();
  };

  return (
    <div className="space-y-8">
      {message && (
        <p role="status" className="text-lg bg-slate-800 border-2 border-slate-600 p-3 rounded-lg">
          {message}
        </p>
      )}

      <section aria-labelledby="exam-list-heading" className="space-y-4">
        <h2 id="exam-list-heading" className="text-2xl font-bold">
          Exams
        </h2>
        {loading && <p role="status">Loading exams…</p>}
        {error && <p role="alert" className="text-red-300">{error}</p>}
        {!loading && exams.length === 0 && <p className="text-lg text-slate-300">No exams yet. Create one below.</p>}
        {exams.map((exam) => (
          <article key={exam.id} className="bg-slate-900 border-2 border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap gap-3 justify-between items-start">
              <div>
                <h3 className="text-xl font-bold">{exam.title}</h3>
                <p className="text-slate-300">
                  {exam.subject} · {exam.duration_minutes} min · {exam.questions[0]?.count ?? 0} questions ·{' '}
                  {new Date(exam.scheduled_start).toLocaleString()} → {new Date(exam.scheduled_end).toLocaleString()}
                </p>
                <p className="text-slate-300">
                  Explanations: {exam.allow_ai_explanations_in_exam ? `on, ${exam.max_question_explanations} per question` : 'off'}
                </p>
              </div>
              <span className={`px-3 py-1 rounded font-bold ${exam.is_published ? 'bg-green-500 text-black' : 'bg-slate-600'}`}>
                {exam.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setOpenExamId(openExamId === exam.id ? null : exam.id)}
                aria-expanded={openExamId === exam.id}
                className={secondaryButton}
              >
                {openExamId === exam.id ? 'Hide questions' : 'Manage questions'}
              </button>
              <button onClick={() => void togglePublish(exam)} className={secondaryButton}>
                {exam.is_published ? 'Unpublish' : 'Publish'}
              </button>
              <button onClick={() => void deleteExam(exam)} className={dangerButton}>
                Delete
              </button>
            </div>
            {openExamId === exam.id && <QuestionEditor examId={exam.id} onChange={reload} />}
          </article>
        ))}
      </section>

      <form onSubmit={createExam} aria-labelledby="new-exam-heading" className="bg-slate-900 border-2 border-slate-700 rounded-xl p-6 space-y-4">
        <h2 id="new-exam-heading" className="text-2xl font-bold">
          Create an exam
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ex-title" className={labelClass}>Title</label>
            <input id="ex-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="ex-subject" className={labelClass}>Subject</label>
            <input id="ex-subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ex-desc" className={labelClass}>Description (optional)</label>
            <textarea id="ex-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="ex-start" className={labelClass}>Opens at</label>
            <input id="ex-start" type="datetime-local" required value={form.scheduled_start} onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="ex-end" className={labelClass}>Closes at</label>
            <input id="ex-end" type="datetime-local" required value={form.scheduled_end} onChange={(e) => setForm({ ...form, scheduled_end: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="ex-duration" className={labelClass}>Duration (minutes)</label>
            <input id="ex-duration" type="number" min={1} max={600} required value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="ex-max" className={labelClass}>Max explanations per question</label>
            <input id="ex-max" type="number" min={0} max={20} value={form.max_question_explanations} onChange={(e) => setForm({ ...form, max_question_explanations: Number(e.target.value) })} className={inputClass} />
          </div>
        </div>
        <label className="flex items-center gap-3 text-lg">
          <input
            type="checkbox"
            checked={form.allow_ai_explanations_in_exam}
            onChange={(e) => setForm({ ...form, allow_ai_explanations_in_exam: e.target.checked })}
            className="w-6 h-6 accent-yellow-400"
          />
          Allow AI question explanations during this exam (never reveals answers)
        </label>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? 'Creating…' : 'Create exam'}
        </button>
      </form>
    </div>
  );
};

interface QuestionRow {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  topic: string | null;
  marks: number;
  order_index: number;
  visual_description: string | null;
}

const emptyQuestion = () => ({
  question_text: '',
  options: ['', '', '', ''],
  correct_option_index: 0,
  topic: '',
  difficulty: 'medium' as 'easy' | 'medium' | 'hard',
  marks: 1,
  visual_description: '',
  explanation: '',
});

const QuestionEditor: React.FC<{ examId: string; onChange: () => void }> = ({ examId, onChange }) => {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [form, setForm] = useState(emptyQuestion);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('questions')
      .select('id, question_text, options, correct_option_index, topic, marks, order_index, visual_description')
      .eq('exam_id', examId)
      .order('order_index');
    if (error) setMessage(error.message);
    else setQuestions((data ?? []) as QuestionRow[]);
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const options = form.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) {
      setMessage('Add at least two options.');
      return;
    }
    const correctText = form.options[form.correct_option_index]?.trim();
    const correctIndex = options.indexOf(correctText ?? '');
    if (correctIndex < 0) {
      setMessage('The correct option cannot be empty.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('questions').insert({
      exam_id: examId,
      question_text: form.question_text.trim(),
      options,
      correct_option_index: correctIndex,
      topic: form.topic.trim() || null,
      difficulty: form.difficulty,
      marks: form.marks,
      visual_description: form.visual_description.trim() || null,
      has_visual_content: Boolean(form.visual_description.trim()),
      explanation: form.explanation.trim() || null,
      order_index: (questions[questions.length - 1]?.order_index ?? 0) + 1,
    });
    setSaving(false);
    if (error) {
      setMessage(`Could not add question: ${error.message}`);
      return;
    }
    setMessage('Question added.');
    setForm(emptyQuestion());
    void load();
    onChange();
  };

  const deleteQuestion = async (q: QuestionRow) => {
    if (!supabase || !window.confirm('Delete this question?')) return;
    const { error } = await supabase.from('questions').delete().eq('id', q.id);
    setMessage(error ? error.message : 'Question deleted.');
    void load();
    onChange();
  };

  return (
    <div className="border-t-2 border-slate-700 pt-4 space-y-4">
      {message && <p role="status" className="text-lg">{message}</p>}
      <ol className="space-y-2 list-decimal pl-6">
        {questions.map((q) => (
          <li key={q.id} className="text-lg">
            <div className="flex flex-wrap gap-3 justify-between">
              <span>
                {q.question_text} <span className="text-slate-300">({q.marks} mark{q.marks === 1 ? '' : 's'}{q.topic ? `, ${q.topic}` : ''})</span>
                <span className="block text-slate-300">
                  {q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}${i === q.correct_option_index ? ' ✓' : ''}`).join('   ')}
                </span>
              </span>
              <button onClick={() => void deleteQuestion(q)} className={dangerButton} aria-label={`Delete question: ${q.question_text}`}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ol>

      <form onSubmit={addQuestion} className="bg-slate-950 border-2 border-slate-700 rounded-lg p-4 space-y-3" aria-label="Add a question">
        <h4 className="text-xl font-bold">Add a question</h4>
        <div>
          <label htmlFor={`q-text-${examId}`} className={labelClass}>Question</label>
          <textarea id={`q-text-${examId}`} required rows={2} value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} className={inputClass} />
        </div>
        <fieldset className="space-y-2">
          <legend className={labelClass}>Options (select the correct one)</legend>
          {form.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="radio"
                name={`correct-${examId}`}
                checked={form.correct_option_index === i}
                onChange={() => setForm({ ...form, correct_option_index: i })}
                aria-label={`Option ${String.fromCharCode(65 + i)} is correct`}
                className="w-6 h-6 accent-yellow-400"
              />
              <input
                value={opt}
                onChange={(e) => setForm({ ...form, options: form.options.map((o, j) => (j === i ? e.target.value : o)) })}
                aria-label={`Option ${String.fromCharCode(65 + i)}`}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className={inputClass}
              />
            </div>
          ))}
          {form.options.length < 6 && (
            <button type="button" onClick={() => setForm({ ...form, options: [...form.options, ''] })} className={secondaryButton}>
              + Add option
            </button>
          )}
        </fieldset>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor={`q-topic-${examId}`} className={labelClass}>Topic</label>
            <input id={`q-topic-${examId}`} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`q-diff-${examId}`} className={labelClass}>Difficulty</label>
            <select id={`q-diff-${examId}`} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })} className={inputClass}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label htmlFor={`q-marks-${examId}`} className={labelClass}>Marks</label>
            <input id={`q-marks-${examId}`} type="number" min={1} value={form.marks} onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor={`q-visual-${examId}`} className={labelClass}>Visual description (for diagrams, charts, images)</label>
          <textarea id={`q-visual-${examId}`} rows={2} value={form.visual_description} onChange={(e) => setForm({ ...form, visual_description: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`q-expl-${examId}`} className={labelClass}>Answer explanation (used in reports; never shown during the exam)</label>
          <textarea id={`q-expl-${examId}`} rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} className={inputClass} />
        </div>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? 'Adding…' : 'Add question'}
        </button>
      </form>
    </div>
  );
};
