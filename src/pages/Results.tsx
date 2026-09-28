import React, { useEffect } from 'react';
import { voiceEngine } from '../../services/voice/voiceEngine';

interface Props {
  candidateName: string;
  score: number;
  totalMarks: number;
  onReturnHome: () => void;
}

export const ResultPage: React.FC<Props> = ({ candidateName, score, totalMarks, onReturnHome }) => {
  const percentage = Math.round((score / totalMarks) * 100);

  useEffect(() => {
    const summary = `Exam completed for candidate ${candidateName}. Your score is ${score} out of ${totalMarks}, or ${percentage} percent.`;
    voiceEngine.speak(summary);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8 flex flex-col justify-center items-center">
      <div className="max-w-3xl w-full bg-slate-900 border-4 border-yellow-400 p-8 rounded-xl shadow-2xl space-y-8">
        <header className="text-center border-b border-slate-700 pb-6">
          <h1 className="text-4xl font-black text-yellow-400 mb-2">Accessible Exam Results</h1>
          <p className="text-2xl text-slate-300">Candidate: {candidateName}</p>
        </header>

        {/* SCORE BANNER */}
        <div className="p-8 bg-black border-4 border-green-500 rounded-xl text-center space-y-4">
          <span className="text-2xl font-bold uppercase tracking-widest text-slate-400">Total Evaluated Score</span>
          <div className="text-6xl font-black text-green-400">
            {score} / {totalMarks} ({percentage}%)
          </div>
        </div>

        {/* AI PERFORMANCE & BARRIER ANALYSIS */}
        <section className="p-6 bg-slate-800 rounded-xl space-y-4">
          <h2 className="text-3xl font-bold text-yellow-400">AI Performance & Learning Barrier Report</h2>
          <div className="space-y-3 text-xl">
            <p><strong className="text-green-400">Strong Topics:</strong> Binary Search Trees, Array Data Structures.</p>
            <p><strong className="text-red-400">Identified Weak Areas:</strong> Time Complexity Analysis under logarithmic constraints.</p>
            <p><strong className="text-yellow-300">Interaction Barrier Insight:</strong> Extended pause detected on Question 1 due to visual description reading; speech rate adjusted automatically.</p>
          </div>
        </section>

        {/* NEXT EXAM SCHEDULE */}
        <section className="p-6 bg-slate-800 border-l-8 border-blue-500 rounded-xl space-y-3">
          <h2 className="text-2xl font-bold text-blue-400">Upcoming Examination Notification</h2>
          <p className="text-xl"><strong>Subject:</strong> Advanced Operating Systems</p>
          <p className="text-xl"><strong>Scheduled Date:</strong> October 15, 2026 at 10:00 AM IST</p>
        </section>

        <footer className="flex justify-end pt-4">
          <button
            onClick={onReturnHome}
            className="w-full py-5 bg-yellow-400 text-black text-2xl font-black rounded hover:bg-yellow-300 focus:ring-8 focus:ring-white transition"
          >
            RETURN TO MAIN MENU
          </button>
        </footer>
      </div>
    </main>
  );
};