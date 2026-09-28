import React, { useState } from 'react';

export const PaperImprovementPanel: React.FC = () => {
  const [rawText, setRawText] = useState('');
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const analyzePaper = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-paper-improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white p-6 rounded-xl space-y-6">
      <h2 className="text-2xl font-bold">AI Exam Paper Improvement & Accessibility Auditor</h2>
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="Paste your exam questions or OCR text here to analyze clarity, visual descriptions, and difficulty..."
        className="w-full h-48 bg-slate-800 p-4 rounded-lg text-lg border border-slate-700 focus:ring-2 focus:ring-yellow-400"
      />
      <button
        onClick={analyzePaper}
        disabled={loading || !rawText.trim()}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-lg rounded-lg disabled:opacity-50"
      >
        {loading ? 'Analyzing with AI...' : 'Run Accessibility & Clarity Audit'}
      </button>

      {analysis && (
        <div className="space-y-4 border-t border-slate-700 pt-4">
          <h3 className="text-xl font-bold text-yellow-400">AI Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="font-bold text-green-400 mb-2">Clarity & Ambiguity Fixes</h4>
              <p>{analysis.claritySuggestions}</p>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="font-bold text-purple-400 mb-2">Missing Visual Descriptions</h4>
              <p>{analysis.visualDescriptionFixes}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};