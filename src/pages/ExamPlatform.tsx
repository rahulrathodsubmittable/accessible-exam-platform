import React, { useState, useEffect } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { supabase } from '../services/supabase/client';
import { offlineDb } from '../services/offline/indexedDb';

export const ExamPlatform: React.FC<{ candidate: any; exam: any }> = ({ candidate, exam }) => {
  const { speakText, announceToScreenReader } = useAccessibility();
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, { option: number | null; skipped: boolean; marked: boolean }>>({});
  const [timeLeft, setTimeLeft] = useState(exam.durationMinutes * 60);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [explanationData, setExplanationData] = useState<{ text: string; remaining: number } | null>(null);

  useEffect(() => {
    fetchQuestions();
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchQuestions = async () => {
    const { data } = await supabase.from('questions').select('*').eq('exam_id', exam.id).order('order_index');
    if (data) {
      setQuestions(data);
      const initial: any = {};
      data.forEach((q) => {
        initial[q.id] = { option: null, skipped: false, marked: false };
      });
      setUserAnswers(initial);
      announceToScreenReader(`Loaded ${data.length} questions. Starting with Question 1.`);
      speakQuestion(data[0]);
    }
  };

  const currentQ = questions[currentIndex];

  const speakQuestion = (q: any) => {
    if (!q) return;
    const text = `Question ${currentIndex + 1} of ${questions.length}. ${q.question_text}. ${
      q.visual_description ? `Visual Description: ${q.visual_description}.` : ''
    } Options are: ${q.options.map((opt: string, idx: number) => `Option ${String.fromCharCode(65 + idx)}:${opt}`).join('. ')}`;
    speakText(text);
  };

  const handleSelectOption = (optIndex: number) => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: { ...prev[currentQ.id], option: optIndex, skipped: false },
    }));
    announceToScreenReader(`Selected Option ${String.fromCharCode(65 + optIndex)}`);
    saveAnswerLocally(currentQ.id, optIndex, false, userAnswers[currentQ.id]?.marked || false);
  };

  const handleSkip = () => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: { ...prev[currentQ.id], skipped: true },
    }));
    announceToScreenReader(`Question ${currentIndex + 1} skipped.`);
    if (currentIndex < questions.length - 1) handleNext();
  };

  const handleMark = () => {
    const newMarked = !userAnswers[currentQ.id]?.marked;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: { ...prev[currentQ.id], marked: newMarked },
    }));
    announceToScreenReader(newMarked ? 'Marked for review.' : 'Unmarked from review.');
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      speakQuestion(questions[nextIdx]);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      speakQuestion(questions[prevIdx]);
    }
  };

  const requestExplanation = async () => {
    if (!exam.allowAiInExam) {
      speakText('Explanations are disabled for this formal examination.');
      return;
    }
    const res = await fetch('/api/request-explanation', {
      method: 'POST',
      body: JSON.stringify({ candidateId: candidate.id, questionId: currentQ.id, mode: 'EXAM' }),
    });
    const data = await res.json();
    if (data.allowed) {
      setExplanationData({ text: data.explanation, remaining: data.remaining });
      speakText(`Explanation: ${data.explanation}. You have ${data.remaining} explanations remaining.`);
    } else {
      speakText(data.message);
    }
  };

  const saveAnswerLocally = async (qId: string, option: number | null, skipped: boolean, marked: boolean) => {
    await offlineDb.answers.put({ questionId: qId, option, skipped, marked, timestamp: Date.now() });
  };

  const handleAutoSubmit = () => {
    speakText('Time has expired. Submitting examination automatically.');
    submitFinalExam();
  };

  const submitFinalExam = async () => {
    // Backend evaluation & store attempt logic
    announceToScreenReader('Exam submitted successfully.');
    window.location.href = '/results';
  };

  useVoiceCommands({
    onReadQuestion: () => speakQuestion(currentQ),
    onNext: handleNext,
    onPrev: handlePrev,
    onSkip: handleSkip,
    onMark: handleMark,
    onSelectOption: (letter) => handleSelectOption(letter.charCodeAt(0) - 65),
    onTimeCheck: () => speakText(`You have ${Math.floor(timeLeft / 60)} minutes and ${timeLeft % 60} seconds remaining.`),
    onExplain: requestExplanation,
    onGoToQuestion: (num) => {
      const idx = parseInt(num) - 1;
      if (idx >= 0 && idx < questions.length) {
        setCurrentIndex(idx);
        speakQuestion(questions[idx]);
      }
    },
  });

  if (!currentQ) return <div className="p-8 text-2xl" role="status">Loading Examination Questions...</div>;

  const answeredCount = Object.values(userAnswers).filter((a) => a.option !== null).length;
  const skippedCount = Object.values(userAnswers).filter((a) => a.skipped).length;
  const markedCount = Object.values(userAnswers).filter((a) => a.marked).length;

  return (
    <main className="max-w-5xl mx-auto p-6 flex flex-col gap-6" id="main-content">
      {/* Header Accessibility Navigation */}
      <header className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl">
        <h1 className="text-2xl font-bold">{exam.title} - Formal Examination</h1>
        <div className="text-xl font-mono" aria-label={`Time remaining: ${Math.floor(timeLeft / 60)} minutes`}>
          Time Left: {Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}
        </div>
      </header>

      {/* Main Question Display */}
      <section className="bg-slate-800 text-white p-6 rounded-xl space-y-6" aria-labelledby="question-heading">
        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
          <h2 id="question-heading" className="text-xl font-semibold">
            Question {currentIndex + 1} of {questions.length}
          </h2>
          {userAnswers[currentQ.id]?.marked && (
            <span className="bg-yellow-500 text-black px-3 py-1 font-bold rounded-md" role="status">
              MARKED FOR REVIEW
            </span>
          )}
        </div>

        <p className="text-2xl font-medium leading-relaxed">{currentQ.question_text}</p>

        {currentQ.has_visual_content && (
          <div className="bg-slate-700 p-4 rounded-lg border-l-4 border-blue-400" aria-label="Visual content description">
            <span className="font-bold block text-blue-300">Visual Content Description:</span>
            <p>{currentQ.visual_description}</p>
          </div>
        )}

        {/* Options List */}
        <div className="grid grid-cols-1 gap-4" role="radiogroup" aria-label="Answer Options">
          {currentQ.options.map((opt: string, idx: number) => {
            const isSelected = userAnswers[currentQ.id]?.option === idx;
            const letter = String.fromCharCode(65 + idx);
            return (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                aria-checked={isSelected}
                role="radio"
                className={`p-4 text-left text-xl rounded-lg border-2 transition-all focus:ring-4 focus:ring-yellow-400 focus:outline-none flex items-center justify-between ${
                  isSelected ? 'bg-blue-600 border-white font-bold' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                }`}
              >
                <span>
                  <strong className="mr-3">{letter}.</strong> {opt}
                </span>
                {isSelected && <span className="text-sm bg-white text-blue-900 px-2 py-1 rounded">Selected</span>}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-700">
          <button onClick={handlePrev} disabled={currentIndex === 0} className="px-6 py-3 bg-gray-700 text-white text-lg font-bold rounded-lg disabled:opacity-50 focus:ring-4 focus:ring-yellow-400">
            Previous
          </button>
          <button onClick={handleSkip} className="px-6 py-3 bg-amber-600 text-white text-lg font-bold rounded-lg focus:ring-4 focus:ring-yellow-400">
            Skip Question
          </button>
          <button onClick={handleMark} className="px-6 py-3 bg-purple-600 text-white text-lg font-bold rounded-lg focus:ring-4 focus:ring-yellow-400">
            {userAnswers[currentQ.id]?.marked ? 'Unmark Review' : 'Mark for Review'}
          </button>
          <button onClick={handleNext} disabled={currentIndex === questions.length - 1} className="px-6 py-3 bg-blue-600 text-white text-lg font-bold rounded-lg disabled:opacity-50 focus:ring-4 focus:ring-yellow-400">
            Next
          </button>
          {exam.allowAiInExam && (
            <button onClick={requestExplanation} className="px-6 py-3 bg-emerald-600 text-white text-lg font-bold rounded-lg focus:ring-4 focus:ring-yellow-400 ml-auto">
              Request AI Explanation
            </button>
          )}
        </div>
      </section>

      {/* Review & Skip Quick-Jump Dashboard */}
      <section className="bg-slate-900 text-white p-6 rounded-xl" aria-label="Question Navigation Summary">
        <h3 className="text-xl font-bold mb-4">Question Status & Quick Jump</h3>
        <div className="flex gap-6 text-lg mb-4">
          <div>Answered: <strong className="text-green-400">{answeredCount}</strong></div>
          <div>Skipped: <strong className="text-amber-400">{skippedCount}</strong></div>
          <div>Marked: <strong className="text-purple-400">{markedCount}</strong></div>
        </div>

        <div className="flex flex-wrap gap-2">
          {questions.map((q, idx) => {
            const state = userAnswers[q.id];
            let bg = 'bg-slate-700';
            if (state?.option !== null && state?.option !== undefined) bg = 'bg-green-600';
            else if (state?.marked) bg = 'bg-purple-600';
            else if (state?.skipped) bg = 'bg-amber-600';

            return (
              <button
                key={q.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  speakQuestion(questions[idx]);
                }}
                aria-label={`Jump to Question ${idx + 1}. ${state?.marked ? 'Marked' : state?.skipped ? 'Skipped' : state?.option !== null ? 'Answered' : 'Unanswered'}`}
                className={`w-12 h-12 text-lg font-bold rounded-lg border-2 border-slate-500 focus:ring-4 focus:ring-yellow-400 ${bg} ${
                  currentIndex === idx ? 'ring-4 ring-yellow-400 scale-110' : ''
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="mt-6 w-full py-4 bg-red-600 hover:bg-red-700 text-white text-2xl font-black rounded-xl focus:ring-4 focus:ring-yellow-400"
        >
          FINISH & SUBMIT EXAMINATION
        </button>
      </section>

      {/* Final Accessible Submission Warning Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="bg-slate-800 text-white p-8 rounded-2xl max-w-xl w-full border-4 border-yellow-400 space-y-6">
            <h2 id="modal-title" className="text-3xl font-extrabold text-yellow-400">
              Confirm Examination Submission
            </h2>
            <div className="text-xl space-y-2">
              <p>Total Questions: <strong>{questions.length}</strong></p>
              <p className="text-green-400">Answered: <strong>{answeredCount}</strong></p>
              <p className="text-amber-400">Skipped: <strong>{skippedCount}</strong></p>
              <p className="text-purple-400">Marked for Review: <strong>{markedCount}</strong></p>
            </div>
            {skippedCount > 0 && (
              <p className="text-amber-300 font-semibold bg-amber-950 p-4 rounded-lg">
                Warning: You have {skippedCount} skipped question(s). You can return to review them now.
              </p>
            )}
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-xl font-bold rounded-lg focus:ring-4 focus:ring-yellow-400"
              >
                Return to Exam
              </button>
              <button
                onClick={submitFinalExam}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-xl font-bold rounded-lg focus:ring-4 focus:ring-yellow-400"
              >
                Yes, Submit Now
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};