import React, { useState } from 'react';
import { ApiError, serverApi } from '../../services/serverApi';
import type { PaperAnalysis } from '../../types';
import { inputClass, primaryButton } from './useTeacherExams';

const SECTIONS: { key: keyof PaperAnalysis; title: string; color: string }[] = [
  { key: 'claritySuggestions', title: 'Clarity & Ambiguity Fixes', color: 'text-green-400' },
  { key: 'visualDescriptionFixes', title: 'Missing Visual Descriptions', color: 'text-purple-300' },
  { key: 'difficultyNotes', title: 'Presentation-Driven Difficulty', color: 'text-amber-300' },
  { key: 'rewrittenQuestions', title: 'Suggested Rewrites', color: 'text-blue-300' },
];

export const PaperImprovementPanel: React.FC = () => {
  const [rawText, setRawText] = useState('');
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const analyzePaper = async () => {
    setLoading(true);
    setError(null);
    try {
      setAnalysis(await serverApi.improvePaper(rawText));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white p-6 rounded-xl space-y-6">
      <h2 className="text-2xl font-bold">AI Exam Paper Improvement & Accessibility Auditor</h2>
      <label htmlFor="paper-text" className="block text-lg">
        Paste exam questions or OCR text to check clarity, visual descriptions and difficulty.
      </label>
      <textarea
        id="paper-text"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        maxLength={20000}
        className={`${inputClass} h-48`}
      />
      <button onClick={() => void analyzePaper()} disabled={loading || !rawText.trim()} className={primaryButton}>
        {loading ? 'Analyzing with AI…' : 'Run Accessibility & Clarity Audit'}
      </button>
      {error && (
        <p role="alert" className="text-lg text-red-300">
          {error}
        </p>
      )}

      {analysis && (
        <section className="space-y-4 border-t border-slate-700 pt-4" aria-labelledby="paper-results">
          <h3 id="paper-results" className="text-xl font-bold text-yellow-400">
            AI Recommendations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SECTIONS.map(({ key, title, color }) => (
              <div key={key} className="bg-slate-800 p-4 rounded-lg">
                <h4 className={`font-bold mb-2 ${color}`}>{title}</h4>
                {analysis[key].length ? (
                  <ul className="list-disc pl-6 space-y-1">
                    {analysis[key].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-300">No issues found.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
