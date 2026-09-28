import React, { useEffect, useState } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { ApiError, serverApi } from '../services/serverApi';
import type { PerformanceAnalysis, SubmitResult } from '../types';

interface Props {
  candidateName: string;
  examTitle: string;
  attemptId: string;
  result: SubmitResult;
  onReturnHome: () => void;
}

export const ResultPage: React.FC<Props> = ({ candidateName, examTitle, attemptId, result, onReturnHome }) => {
  const { speakText } = useAccessibility();
  const { score, totalMarks } = result;
  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    speakText(`Exam completed for ${candidateName}. Your score is ${score} out of ${totalMarks}, or ${percentage} percent.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    serverApi
      .performanceAnalysis(attemptId)
      .then((a) => !cancelled && setAnalysis(a))
      .catch((err) => !cancelled && setAnalysisError(err instanceof ApiError ? err.message : 'The report could not be loaded.'));
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const readReport = () => {
    if (!analysis) return;
    speakText(
      [
        analysis.overallSummary,
        analysis.strongTopics.length ? `Strong topics: ${analysis.strongTopics.join(', ')}.` : '',
        analysis.weakTopics.length ? `Topics to work on: ${analysis.weakTopics.join(', ')}.` : '',
        analysis.recommendedPractice.length ? `Recommended practice: ${analysis.recommendedPractice.join(' ')}` : '',
      ].join(' '),
    );
  };

  return (
    <main id="main-content" className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 pt-16 flex flex-col items-center">
      <div className="max-w-3xl w-full bg-slate-900 border-4 border-yellow-400 p-6 sm:p-8 rounded-xl shadow-2xl space-y-8">
        <header className="text-center border-b border-slate-700 pb-6">
          <h1 className="text-4xl font-black text-yellow-400 mb-2 outline-none" tabIndex={-1}>
            Exam Results
          </h1>
          <p className="text-2xl text-slate-300">{examTitle}</p>
          <p className="text-xl text-slate-300">Candidate: {candidateName}</p>
        </header>

        {/* SCORE BANNER */}
        <div className="p-8 bg-black border-4 border-green-500 rounded-xl text-center space-y-4">
          <span className="block text-2xl font-bold uppercase tracking-widest text-slate-300">Total Evaluated Score</span>
          <p className="text-5xl sm:text-6xl font-black text-green-400">
            {score} / {totalMarks} ({percentage}%)
          </p>
          <p className="text-xl">
            {result.correctCount} of {result.totalQuestions} correct · {result.skippedCount} unanswered
          </p>
        </div>

        {/* AI PERFORMANCE & BARRIER ANALYSIS */}
        <section className="p-6 bg-slate-800 rounded-xl space-y-4" aria-labelledby="report-heading" aria-busy={!analysis && !analysisError}>
          <h2 id="report-heading" className="text-3xl font-bold text-yellow-400">
            Performance & Learning Barrier Report
          </h2>
          {!analysis && !analysisError && (
            <p role="status" className="text-xl">
              Preparing your report…
            </p>
          )}
          {analysisError && (
            <p role="alert" className="text-xl text-amber-300">
              {analysisError}
            </p>
          )}
          {analysis && (
            <div className="space-y-3 text-xl">
              <p>{analysis.overallSummary}</p>
              {analysis.strongTopics.length > 0 && (
                <p>
                  <strong className="text-green-400">Strong topics:</strong> {analysis.strongTopics.join(', ')}.
                </p>
              )}
              {analysis.weakTopics.length > 0 && (
                <p>
                  <strong className="text-red-300">Topics to work on:</strong> {analysis.weakTopics.join(', ')}.
                </p>
              )}
              {analysis.learningBarriers.length > 0 && (
                <div>
                  <strong className="text-yellow-300">Accessibility insights:</strong>
                  <ul className="list-disc pl-8">
                    {analysis.learningBarriers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.recommendedPractice.length > 0 && (
                <div>
                  <strong className="text-blue-300">Recommended practice:</strong>
                  <ul className="list-disc pl-8">
                    {analysis.recommendedPractice.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button onClick={readReport} className="px-5 py-3 bg-slate-700 border-2 border-slate-500 rounded-lg font-bold">
                Read report aloud
              </button>
            </div>
          )}
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
