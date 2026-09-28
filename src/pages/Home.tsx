import React from 'react';
import { voiceEngine } from '../../services/voice/voiceEngine';

interface Props {
  onSelectExamMode: () => void;
  onSelectPracticeMode: () => void;
  onSelectTeacherMode: () => void;
}

export const HomePage: React.FC<Props> = ({
  onSelectExamMode,
  onSelectPracticeMode,
  onSelectTeacherMode,
}) => {
  const announceOption = (text: string) => {
    voiceEngine.speak(text);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8 flex flex-col justify-center items-center">
      <div className="max-w-3xl w-full bg-slate-900 border-4 border-slate-700 p-8 rounded-xl shadow-2xl space-y-8">
        <header className="text-center space-y-4">
          <h1 className="text-5xl font-black text-yellow-400 tracking-wide" tabIndex={0}>
            AI Accessible Exam Platform
          </h1>
          <p className="text-2xl text-slate-300" tabIndex={0}>
            SISTec Innovation Hackathon 2026 — DT-13
          </p>
          <div className="p-4 bg-slate-800 border-l-4 border-yellow-400 text-xl font-semibold text-yellow-300">
            “No Visual Barrier. No Learning Barrier. No Examination Barrier.”
          </div>
        </header>

        <div className="space-y-6 pt-4">
          {/* EXAM MODE BUTTON */}
          <button
            onClick={onSelectExamMode}
            onFocus={() => announceOption('Option 1: Exam Mode. Press Enter to enter your Candidate Exam ID.')}
            className="w-full p-8 bg-yellow-400 text-black rounded-xl text-left border-4 border-yellow-300 hover:bg-yellow-300 focus:ring-8 focus:ring-white transition"
          >
            <div className="text-3xl font-black mb-2">1. FORMAL EXAM MODE</div>
            <p className="text-xl font-medium">Enter using your unique Candidate Exam ID. Scheduled assessments with auto-evaluation.</p>
          </button>

          {/* PRACTICE MODE BUTTON */}
          <button
            onClick={onSelectPracticeMode}
            onFocus={() => announceOption('Option 2: Practice Mode. Press Enter for interactive self-paced learning.')}
            className="w-full p-8 bg-slate-800 text-white rounded-xl text-left border-4 border-slate-600 hover:border-yellow-400 focus:ring-8 focus:ring-white transition"
          >
            <div className="text-3xl font-black text-yellow-400 mb-2">2. INTERACTIVE PRACTICE MODE</div>
            <p className="text-xl font-medium text-slate-300">Practice subjects, receive AI guidance, OCR document practice, and performance analytics.</p>
          </button>

          {/* TEACHER DASHBOARD LINK */}
          <button
            onClick={onSelectTeacherMode}
            onFocus={() => announceOption('Option 3: Teacher and Administrator Portal.')}
            className="w-full p-6 bg-slate-900 text-slate-400 rounded-xl text-left border-2 border-slate-700 hover:text-white hover:border-slate-500 focus:ring-4 focus:ring-white transition"
          >
            <div className="text-2xl font-bold">3. Teacher / Admin Control Portal</div>
          </button>
        </div>
      </div>
    </main>
  );
};