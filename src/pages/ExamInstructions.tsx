import React, { useState } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { ApiError, serverApi } from '../services/serverApi';
import type { ExamSession, VerifyResult } from '../types';

interface Props {
  verified: VerifyResult;
  onStarted: (session: ExamSession) => void;
  onBack: () => void;
}

export const KEYBOARD_SHORTCUTS: [string, string][] = [
  ['1 to 6', 'Select option A, B, C…'],
  ['N / P', 'Next / previous question'],
  ['R', 'Repeat the question'],
  ['O', 'Read all options'],
  ['S', 'Skip the question'],
  ['M', 'Mark or unmark for review'],
  ['T', 'Hear the time left'],
  ['E', 'Request an explanation (if allowed)'],
  ['H', 'Hear these shortcuts'],
  ['Alt + A', 'Accessibility settings'],
];

export const VOICE_COMMANDS = [
  'read question',
  'read options',
  'select option B',
  'next question',
  'previous question',
  'skip question',
  'mark for review',
  'go to question 3',
  'how much time is left',
  'explain question',
  'submit exam',
];

export const ExamInstructions: React.FC<Props> = ({ verified, onStarted, onBack }) => {
  const { speakText } = useAccessibility();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { exam, candidate } = verified;

  const summary =
    `${exam.title}. ${exam.questionCount} questions. You have ${exam.durationMinutes} minutes. ` +
    'The timer starts when you press Start Exam. You can only submit once. ' +
    'Answers save automatically, even if your internet connection drops. ' +
    (exam.allowAiInExam
      ? `You may request up to ${exam.maxExplanations} explanations per question. They explain the question but never the answer. `
      : 'Explanations are not available in this exam. ');

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await serverApi.startExam(candidate.candidateCode);
      onStarted(session);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not start the exam. Please try again.';
      setError(message);
      speakText(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="min-h-screen p-4 sm:p-8 flex justify-center">
      <div className="max-w-3xl w-full space-y-6 pt-12">
        <h1 className="text-4xl font-black text-yellow-400 outline-none" tabIndex={-1}>
          {exam.title}
        </h1>
        <p className="text-2xl">
          Candidate: <strong>{candidate.fullName}</strong> ({candidate.candidateCode})
        </p>
        {verified.hasAttemptInProgress && (
          <p className="text-xl font-semibold bg-blue-950 border-2 border-blue-400 p-4 rounded-lg">
            You already started this exam. Pressing Resume continues where you left off; the timer has kept running.
          </p>
        )}

        <section aria-labelledby="rules-heading" className="bg-slate-900 border-2 border-slate-700 rounded-xl p-6 space-y-3 text-xl">
          <h2 id="rules-heading" className="text-2xl font-bold text-yellow-400">
            Before you begin
          </h2>
          <p>{summary}</p>
          <button
            type="button"
            onClick={() => speakText(summary)}
            className="px-5 py-3 bg-slate-700 border-2 border-slate-500 rounded-lg font-bold focus:ring-4 focus:ring-yellow-400"
          >
            Read instructions aloud
          </button>
        </section>

        <section aria-labelledby="keys-heading" className="bg-slate-900 border-2 border-slate-700 rounded-xl p-6">
          <h2 id="keys-heading" className="text-2xl font-bold text-yellow-400 mb-3">
            Keyboard shortcuts
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-xl">
            {KEYBOARD_SHORTCUTS.map(([key, action]) => (
              <React.Fragment key={key}>
                <dt className="font-mono font-bold text-yellow-300">{key}</dt>
                <dd>{action}</dd>
              </React.Fragment>
            ))}
          </dl>
        </section>

        <section aria-labelledby="voice-heading" className="bg-slate-900 border-2 border-slate-700 rounded-xl p-6">
          <h2 id="voice-heading" className="text-2xl font-bold text-yellow-400 mb-3">
            Voice commands
          </h2>
          <p className="text-xl mb-2">If your browser supports it and you allow the microphone, you can say:</p>
          <ul className="list-disc pl-8 text-xl grid sm:grid-cols-2 gap-1">
            {VOICE_COMMANDS.map((c) => (
              <li key={c}>“{c}”</li>
            ))}
          </ul>
        </section>

        {error && (
          <p role="alert" className="text-xl font-semibold text-red-300 bg-red-950 border-2 border-red-500 p-4 rounded-lg">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 pb-8">
          <button onClick={onBack} className="flex-1 py-4 bg-slate-800 border-2 border-slate-600 text-xl font-bold rounded-lg">
            ← Cancel
          </button>
          <button
            onClick={start}
            disabled={loading}
            className="flex-[2] py-5 bg-yellow-400 text-black text-2xl font-black rounded-lg disabled:opacity-60 focus:ring-8 focus:ring-white"
          >
            {loading ? 'Starting…' : verified.hasAttemptInProgress ? 'Resume Exam' : 'Start Exam'}
          </button>
        </div>
      </div>
    </main>
  );
};
