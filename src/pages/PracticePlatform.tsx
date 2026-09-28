import React, { useMemo, useState } from 'react';
import { PRACTICE_BANK, PRACTICE_SUBJECTS, type PracticeQuestion } from '../../shared/practiceBank';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { ApiError, serverApi } from '../services/serverApi';

interface Props {
  onBackToHome: () => void;
}

const letter = (idx: number) => String.fromCharCode(65 + idx);

interface Outcome {
  questionId: string;
  topic: string;
  correct: boolean;
  attempts: number;
}

export const PracticeEngine: React.FC<Props> = ({ onBackToHome }) => {
  const { speakText, announceToScreenReader } = useAccessibility();
  const [subject, setSubject] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [finished, setFinished] = useState(false);

  const questions = useMemo(() => PRACTICE_BANK.filter((q) => q.subject === subject), [subject]);
  const currentQ: PracticeQuestion | undefined = questions[currentIndex];
  const isCorrect = currentQ && selected === currentQ.correctOptionIndex;

  const describe = (q: PracticeQuestion, idx: number, total = questions.length) =>
    `Practice question ${idx + 1} of ${total}. ${q.questionText} ` +
    (q.visualDescription ? `Visual description: ${q.visualDescription}. ` : '') +
    `Options: ${q.options.map((o, i) => `Option ${letter(i)}: ${o}`).join('. ')}.`;

  const startSubject = (s: string) => {
    setSubject(s);
    setCurrentIndex(0);
    setSelected(null);
    setTries(0);
    setOutcomes({});
    setAiExplanation(null);
    setFinished(false);
    const subjectQuestions = PRACTICE_BANK.filter((q) => q.subject === s);
    if (subjectQuestions[0]) speakText(`${s} practice. ${describe(subjectQuestions[0], 0, subjectQuestions.length)}`);
  };

  const handleSelectOption = (optIndex: number) => {
    if (!currentQ || optIndex < 0 || optIndex >= currentQ.options.length) return;
    const correct = optIndex === currentQ.correctOptionIndex;
    const attemptsSoFar = tries + 1;
    setSelected(optIndex);
    setTries(attemptsSoFar);
    setAiExplanation(null);
    setOutcomes((prev) => ({
      ...prev,
      // First answer decides whether the topic counts as correct; retries are for learning.
      [currentQ.id]: prev[currentQ.id] ?? { questionId: currentQ.id, topic: currentQ.topic, correct, attempts: attemptsSoFar },
    }));
    const feedback = correct
      ? `Correct! Option ${letter(optIndex)}, ${currentQ.options[optIndex]}.`
      : `Not quite. Option ${letter(optIndex)} is incorrect. You can try again, or ask for an explanation.`;
    announceToScreenReader(feedback, 'assertive');
    speakText(feedback);
  };

  const goTo = (idx: number) => {
    if (idx >= questions.length) {
      setFinished(true);
      speakText('Practice complete. Your summary is on screen.');
      return;
    }
    if (idx < 0) return;
    setCurrentIndex(idx);
    setSelected(null);
    setTries(0);
    setAiExplanation(null);
    speakText(describe(questions[idx], idx));
  };

  const handleGetExplanation = async () => {
    if (!currentQ || loadingExplanation) return;
    setLoadingExplanation(true);
    speakText('Getting an explanation.');
    try {
      const { explanation } = await serverApi.practiceExplain(currentQ.id, selected);
      setAiExplanation(explanation);
      speakText(explanation);
    } catch (err) {
      // Offline or server unavailable: the built-in explanation still helps.
      const fallback = currentQ.explanation;
      setAiExplanation(fallback);
      speakText(err instanceof ApiError && err.isNetworkError ? `You are offline. ${fallback}` : fallback);
    } finally {
      setLoadingExplanation(false);
    }
  };

  useVoiceCommands(
    {
      onReadQuestion: () => currentQ && speakText(describe(currentQ, currentIndex)),
      onReadOptions: () => currentQ && speakText(currentQ.options.map((o, i) => `Option ${letter(i)}: ${o}`).join('. ')),
      onSelectOption: handleSelectOption,
      onNext: () => goTo(currentIndex + 1),
      onPrev: () => goTo(currentIndex - 1),
      onExplain: () => void handleGetExplanation(),
    },
    Boolean(currentQ) && !finished,
  );

  const header = (
    <header className="flex flex-wrap gap-4 justify-between items-center border-b-4 border-slate-700 pb-4 mb-6">
      <div>
        <h1 className="text-4xl font-black text-yellow-400 outline-none" tabIndex={-1}>
          Interactive Practice Mode
        </h1>
        <p className="text-xl text-slate-300">{subject ? `Subject: ${subject}` : 'Choose a subject to begin'} — unlimited tries</p>
      </div>
      <button onClick={onBackToHome} className="px-6 py-3 bg-slate-800 text-white font-bold text-xl rounded border-2 border-slate-600 hover:border-yellow-400">
        ← Exit Practice
      </button>
    </header>
  );

  if (!subject) {
    return (
      <main id="main-content" className="min-h-screen p-4 sm:p-8 pt-16">
        <div className="max-w-4xl mx-auto">
          {header}
          <h2 className="text-2xl font-bold mb-4">Choose a subject</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {PRACTICE_SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => startSubject(s)}
                onFocus={() => speakText(s)}
                className="p-6 bg-slate-800 border-4 border-slate-600 hover:border-yellow-400 rounded-xl text-2xl font-bold text-left focus:ring-4 focus:ring-white"
              >
                {s}
                <span className="block text-lg font-normal text-slate-300 mt-1">
                  {PRACTICE_BANK.filter((q) => q.subject === s).length} questions
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (finished || !currentQ) {
    const results = Object.values(outcomes);
    const correct = results.filter((r) => r.correct).length;
    const weakTopics = [...new Set(results.filter((r) => !r.correct).map((r) => r.topic))];
    return (
      <main id="main-content" className="min-h-screen p-4 sm:p-8 pt-16">
        <div className="max-w-4xl mx-auto space-y-6">
          {header}
          <section className="p-6 bg-slate-800 border-4 border-green-500 rounded-xl space-y-3 text-xl" aria-labelledby="practice-summary">
            <h2 id="practice-summary" className="text-3xl font-black text-green-400">
              Practice Summary
            </h2>
            <p>
              You got <strong>{correct}</strong> of <strong>{questions.length}</strong> right on the first try.
            </p>
            {weakTopics.length > 0 ? (
              <p>
                <strong className="text-yellow-300">Recommended topics to review:</strong> {weakTopics.join(', ')}.
              </p>
            ) : (
              <p className="text-green-300">Excellent — no weak topics in this set.</p>
            )}
          </section>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => startSubject(subject)} className="px-6 py-4 bg-yellow-400 text-black text-xl font-black rounded-lg">
              Practice {subject} again
            </button>
            <button onClick={() => setSubject(null)} className="px-6 py-4 bg-slate-800 border-2 border-slate-600 text-xl font-bold rounded-lg">
              Choose another subject
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-screen p-4 sm:p-8 pt-16">
      <div className="max-w-4xl mx-auto space-y-6">
        {header}
        <section className="p-6 bg-slate-800 border-2 border-slate-700 rounded-xl space-y-4" aria-labelledby="practice-q">
          <p className="text-lg uppercase tracking-wider font-bold text-yellow-400">
            Practice Item {currentIndex + 1} of {questions.length} · {currentQ.topic}
          </p>
          <h2 id="practice-q" className="text-3xl font-bold">
            {currentQ.questionText}
          </h2>
          {currentQ.visualDescription && (
            <p className="bg-slate-700 p-4 rounded-lg border-l-4 border-blue-400 text-xl">
              <strong className="text-blue-300">Visual description:</strong> {currentQ.visualDescription}
            </p>
          )}

          <div className="space-y-4 pt-4" role="radiogroup" aria-labelledby="practice-q">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selected === idx;
              const style = !isSelected
                ? 'bg-slate-900 text-white border-slate-700 hover:border-yellow-400'
                : idx === currentQ.correctOptionIndex
                  ? 'bg-green-500 text-black border-white'
                  : 'bg-red-500 text-black border-white';
              return (
                <button
                  key={idx}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectOption(idx)}
                  className={`w-full p-5 text-left text-2xl font-bold rounded border-4 transition ${style}`}
                >
                  Option {letter(idx)}: {opt}
                  {isSelected && <span className="ml-3">{idx === currentQ.correctOptionIndex ? '✓ Correct' : '✗ Try again'}</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* AI PRACTICE ASSISTANT PANEL */}
        <div className="flex flex-wrap gap-4">
          <button onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} className="px-6 py-4 bg-slate-700 text-xl font-bold rounded disabled:opacity-50">
            ← Previous
          </button>
          <button
            onClick={() => void handleGetExplanation()}
            disabled={loadingExplanation}
            className="px-6 py-4 bg-purple-700 hover:bg-purple-600 text-xl font-bold rounded focus:ring-4 focus:ring-white disabled:opacity-60"
          >
            {loadingExplanation ? 'Thinking…' : '💡 Explain this question'}
          </button>
          <button onClick={() => goTo(currentIndex + 1)} className="px-6 py-4 bg-blue-600 text-xl font-bold rounded sm:ml-auto">
            {currentIndex === questions.length - 1 ? 'Finish practice' : 'Next →'}
          </button>
        </div>
        {isCorrect === false && selected !== null && tries > 0 && (
          <p className="text-xl text-slate-300">Attempts on this question: {tries}</p>
        )}

        {aiExplanation && (
          <section className="p-6 bg-slate-800 border-4 border-green-500 rounded-xl text-2xl text-green-300" aria-labelledby="practice-explanation">
            <h3 id="practice-explanation" className="font-bold text-green-400 mb-2">
              Practice Learning Tip & Concept Breakdown:
            </h3>
            <p className="whitespace-pre-line">{aiExplanation}</p>
          </section>
        )}
      </div>
    </main>
  );
};
