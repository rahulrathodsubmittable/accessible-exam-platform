import React, { useState } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { ApiError, serverApi } from '../services/serverApi';
import type { VerifyResult } from '../types';

interface Props {
  onVerified: (result: VerifyResult) => void;
  onBack: () => void;
}

export const ExamVerification: React.FC<Props> = ({ onVerified, onBack }) => {
  const { speakText, announceToScreenReader } = useAccessibility();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter your Candidate ID.');
      return;
    }
    setLoading(true);
    setError(null);
    announceToScreenReader('Checking your Candidate ID.');
    try {
      const result = await serverApi.verifyCandidate(code);
      speakText(`Welcome ${result.candidate.fullName}. Your ID is verified.`);
      onVerified(result);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      speakText(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="min-h-screen p-4 sm:p-8 flex flex-col justify-center items-center">
      <div className="max-w-2xl w-full bg-slate-900 border-4 border-slate-700 p-6 sm:p-8 rounded-xl space-y-6">
        <h1 className="text-4xl font-black text-yellow-400 outline-none" tabIndex={-1}>
          Enter Your Candidate ID
        </h1>
        <p className="text-xl text-slate-300">
          Your Candidate ID was given to you by your exam coordinator. It looks like <strong>EXM-2026-A7K92</strong>. You do not need a
          password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label htmlFor="candidate-code" className="block text-2xl font-bold">
            Candidate ID
          </label>
          <input
            id="candidate-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="EXM-2026-XXXXX"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'candidate-code-error' : undefined}
            className="w-full p-4 text-3xl font-mono tracking-widest bg-black border-4 border-slate-500 rounded-lg focus:border-yellow-400"
          />
          {error && (
            <p id="candidate-code-error" role="alert" className="text-xl font-semibold text-red-300 bg-red-950 border-2 border-red-500 p-4 rounded-lg">
              {error}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-4 bg-slate-800 border-2 border-slate-600 text-xl font-bold rounded-lg focus:ring-4 focus:ring-white"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-4 bg-yellow-400 text-black text-2xl font-black rounded-lg disabled:opacity-60 focus:ring-4 focus:ring-white"
            >
              {loading ? 'Checking…' : 'Verify ID'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
