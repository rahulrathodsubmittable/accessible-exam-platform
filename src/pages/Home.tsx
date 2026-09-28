import React, { useEffect } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';

interface Props {
  onSelectExamMode: () => void;
  onSelectPracticeMode: () => void;
  onSelectTeacherMode: () => void;
}

export const HomePage: React.FC<Props> = ({ onSelectExamMode, onSelectPracticeMode, onSelectTeacherMode }) => {
  const { speakText } = useAccessibility();

  // Number keys 1–3 choose a mode directly.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      if (e.key === '1') onSelectExamMode();
      else if (e.key === '2') onSelectPracticeMode();
      else if (e.key === '3') onSelectTeacherMode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSelectExamMode, onSelectPracticeMode, onSelectTeacherMode]);

  return (
    <main id="main-content" className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 flex flex-col justify-center items-center">
      <div className="max-w-3xl w-full bg-slate-900 border-4 border-slate-700 p-6 sm:p-8 rounded-xl shadow-2xl space-y-8">
        <header className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-black text-yellow-400 tracking-wide outline-none" tabIndex={-1}>
            AI Accessible Exam Platform
          </h1>
          <p className="text-xl sm:text-2xl text-slate-300">SISTec Innovation Hackathon 2026 — DT-13</p>
          <p className="p-4 bg-slate-800 border-l-4 border-yellow-400 text-xl font-semibold text-yellow-300">
            “No Visual Barrier. No Learning Barrier. No Examination Barrier.”
          </p>
          <p className="text-lg text-slate-300">Press 1, 2 or 3 to choose, or use Tab and Enter.</p>
        </header>

        <nav aria-label="Choose a mode" className="space-y-6 pt-4">
          {/* EXAM MODE BUTTON */}
          <button
            onClick={onSelectExamMode}
            onFocus={() => speakText('Option 1: Exam Mode. Press Enter to enter your Candidate Exam ID.')}
            className="w-full p-6 sm:p-8 bg-yellow-400 text-black rounded-xl text-left border-4 border-yellow-300 hover:bg-yellow-300 focus:ring-8 focus:ring-white transition"
          >
            <span className="block text-2xl sm:text-3xl font-black mb-2">1. FORMAL EXAM MODE</span>
            <span className="block text-xl font-medium">Enter using your unique Candidate Exam ID. Scheduled assessments with auto-evaluation.</span>
          </button>

          {/* PRACTICE MODE BUTTON */}
          <button
            onClick={onSelectPracticeMode}
            onFocus={() => speakText('Option 2: Practice Mode. Press Enter for interactive self-paced learning.')}
            className="w-full p-6 sm:p-8 bg-slate-800 text-white rounded-xl text-left border-4 border-slate-600 hover:border-yellow-400 focus:ring-8 focus:ring-white transition"
          >
            <span className="block text-2xl sm:text-3xl font-black text-yellow-400 mb-2">2. INTERACTIVE PRACTICE MODE</span>
            <span className="block text-xl font-medium text-slate-300">Practice subjects at your own pace with AI explanations and topic recommendations.</span>
          </button>

          {/* TEACHER DASHBOARD LINK */}
          <button
            onClick={onSelectTeacherMode}
            onFocus={() => speakText('Option 3: Teacher and Administrator Portal.')}
            className="w-full p-6 bg-slate-900 text-slate-300 rounded-xl text-left border-2 border-slate-700 hover:text-white hover:border-slate-500 focus:ring-4 focus:ring-white transition"
          >
            <span className="block text-2xl font-bold">3. Teacher / Admin Control Portal</span>
          </button>
        </nav>
      </div>
    </main>
  );
};
