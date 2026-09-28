import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { offlineDb } from '../services/offline/indexedDb';
import { ApiError, serverApi } from '../services/serverApi';
import type { AnswerInput, AnswerState, ExamSession, PublicQuestion, SubmitResult } from '../types';
import { KEYBOARD_SHORTCUTS } from './ExamInstructions';

interface Props {
  session: ExamSession;
  onComplete: (result: SubmitResult) => void;
}

const letter = (idx: number) => String.fromCharCode(65 + idx);
const NAV_DELAY_SECONDS = 120;
const TIME_WARNINGS = [600, 300, 60];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function spokenTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} minute${m === 1 ? '' : 's'} and ${s} second${s === 1 ? '' : 's'}`;
}

function toInput(questionId: string, state: AnswerState): AnswerInput {
  return { questionId, selectedOptionIndex: state.option, isSkipped: state.skipped, isMarked: state.marked };
}

export const ExamPlatform: React.FC<Props> = ({ session, onComplete }) => {
  const { speakText, announceToScreenReader } = useAccessibility();
  const { questions, exam, attempt } = session;
  const attemptId = attempt.id;
  const { isOnline, pendingCount } = useOfflineSync(attemptId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, AnswerState>>(() => {
    const initial: Record<string, AnswerState> = {};
    for (const q of questions) initial[q.id] = { option: null, skipped: false, marked: false };
    for (const a of session.savedAnswers) {
      initial[a.questionId] = { option: a.selectedOptionIndex, skipped: a.isSkipped, marked: a.isMarked };
    }
    return initial;
  });
  const answersRef = useRef(userAnswers);
  answersRef.current = userAnswers;

  // Timer is driven by the server's deadline, corrected for clock differences.
  const clockOffset = useMemo(() => new Date(session.serverTime).getTime() - Date.now(), [session.serverTime]);
  const deadline = useMemo(() => new Date(attempt.deadline).getTime(), [attempt.deadline]);
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  const timeLeft = Math.max(0, Math.ceil((deadline - now) / 1000));

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'waiting-for-network'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<{ text: string; remaining: number } | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);

  const currentQ: PublicQuestion = questions[currentIndex];
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);

  // --- Barrier analytics state (never contains personal data) ---
  const readCounts = useRef<Record<string, number>>({});
  const loggedRepeat = useRef<Set<string>>(new Set());
  const enteredAt = useRef(Date.now());
  const consecutiveSkips = useRef(0);
  const lastVoiceErrorLog = useRef(0);

  // --- Speech ---
  const describeQuestion = useCallback(
    (idx: number) => {
      const q = questions[idx];
      if (!q) return '';
      return (
        `Question ${idx + 1} of ${questions.length}. ${q.marks} mark${q.marks === 1 ? '' : 's'}. ${q.questionText} ` +
        (q.visualDescription ? `Visual description: ${q.visualDescription}. ` : '') +
        `Options: ${q.options.map((opt, i) => `Option ${letter(i)}: ${opt}`).join('. ')}.`
      );
    },
    [questions],
  );

  const speakQuestion = useCallback((idx: number) => speakText(describeQuestion(idx)), [describeQuestion, speakText]);

  const repeatQuestion = () => {
    speakQuestion(currentIndex);
    const count = (readCounts.current[currentQ.id] ?? 0) + 1;
    readCounts.current[currentQ.id] = count;
    if (count >= 3 && !loggedRepeat.current.has(currentQ.id)) {
      loggedRepeat.current.add(currentQ.id);
      void serverApi.logBarrier(attemptId, 'repeated_read', currentQ.id, { reads: count });
    }
  };

  // Read the first question once on load.
  useEffect(() => {
    announceToScreenReader(`Exam started. ${questions.length} questions. Time left: ${spokenTime(timeLeft)}.`);
    speakQuestion(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Navigation ---
  const goTo = (idx: number) => {
    if (idx < 0 || idx >= questions.length || idx === currentIndex) return;
    const elapsed = (Date.now() - enteredAt.current) / 1000;
    if (elapsed > NAV_DELAY_SECONDS && userAnswers[currentQ.id]?.option === null) {
      void serverApi.logBarrier(attemptId, 'nav_delay', currentQ.id, { seconds: Math.round(elapsed) });
    }
    enteredAt.current = Date.now();
    setCurrentIndex(idx);
    setExplanation(null);
    speakQuestion(idx);
    requestAnimationFrame(() => questionHeadingRef.current?.focus());
  };
  const handleNext = () => {
    if (currentIndex < questions.length - 1) goTo(currentIndex + 1);
    else speakText('This is the last question. Say submit exam, or press the Finish button, when you are ready.');
  };
  const handlePrev = () => {
    if (currentIndex > 0) goTo(currentIndex - 1);
    else speakText('This is the first question.');
  };

  // --- Answers (saved locally first, then to the server) ---
  const persistAnswer = async (questionId: string, state: AnswerState) => {
    const input = toInput(questionId, state);
    const record = await offlineDb.saveAnswer(attemptId, input, false);
    try {
      await serverApi.saveAnswer(attemptId, input);
      await offlineDb.markSynced(record);
    } catch (err) {
      if (err instanceof ApiError && !err.isNetworkError && err.code === 'TIME_UP') {
        announceToScreenReader('Time is up.', 'assertive');
      }
      // Network errors: stays unsynced and is retried by useOfflineSync.
    }
  };

  const updateAnswer = (questionId: string, patch: Partial<AnswerState>) => {
    const next = { ...answersRef.current[questionId], ...patch };
    setUserAnswers((prev) => ({ ...prev, [questionId]: next }));
    void persistAnswer(questionId, next);
    return next;
  };

  const handleSelectOption = (optIndex: number) => {
    if (optIndex < 0 || optIndex >= currentQ.options.length) {
      speakText(`There is no option ${letter(optIndex)} for this question.`);
      return;
    }
    consecutiveSkips.current = 0;
    updateAnswer(currentQ.id, { option: optIndex, skipped: false });
    speakText(`Option ${letter(optIndex)} selected: ${currentQ.options[optIndex]}.`);
  };

  const handleSkip = () => {
    updateAnswer(currentQ.id, { skipped: true });
    consecutiveSkips.current += 1;
    if (consecutiveSkips.current === 3) {
      void serverApi.logBarrier(attemptId, 'skip_spike', currentQ.id, { consecutive: 3 });
    }
    announceToScreenReader(`Question ${currentIndex + 1} skipped.`);
    if (currentIndex < questions.length - 1) goTo(currentIndex + 1);
    else speakText('Question skipped. This was the last question.');
  };

  const handleMark = () => {
    const next = updateAnswer(currentQ.id, { marked: !userAnswers[currentQ.id]?.marked });
    speakText(next.marked ? 'Marked for review.' : 'Removed from review.');
  };

  const readOptions = () => speakText(currentQ.options.map((opt, i) => `Option ${letter(i)}: ${opt}`).join('. '));
  const readOption = (idx: number) => {
    const opt = currentQ.options[idx];
    speakText(opt === undefined ? `There is no option ${letter(idx)}.` : `Option ${letter(idx)}: ${opt}`);
  };
  const speakTimeLeft = () => speakText(`You have ${spokenTime(timeLeft)} remaining.`);
  const speakShortcuts = () => speakText(KEYBOARD_SHORTCUTS.map(([k, a]) => `${k}: ${a}`).join('. '));

  // --- Explanations ---
  const requestExplanation = async () => {
    if (!exam.allowAiInExam) {
      speakText('Explanations are turned off for this formal examination.');
      return;
    }
    if (explanationLoading) return;
    setExplanationLoading(true);
    speakText('Requesting an explanation. Please wait.');
    try {
      const data = await serverApi.requestExplanation(attemptId, currentQ.id);
      setExplanation({ text: data.explanation, remaining: data.remaining });
      speakText(`Explanation: ${data.explanation} You have ${data.remaining} explanation${data.remaining === 1 ? '' : 's'} left for this question.`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'The explanation could not be loaded.';
      speakText(message);
      announceToScreenReader(message, 'assertive');
    } finally {
      setExplanationLoading(false);
    }
  };

  // --- Submission ---
  const submittingRef = useRef(false);
  const submitFinalExam = useCallback(
    async (reason: 'manual' | 'timeout') => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitState('submitting');
      setSubmitError(null);
      if (reason === 'timeout') speakText('Time has expired. Submitting your examination automatically.');
      else announceToScreenReader('Submitting your examination.', 'assertive');

      const answers = Object.entries(answersRef.current).map(([id, state]) => toInput(id, state));
      try {
        const result = await serverApi.submitExam(attemptId, answers);
        await offlineDb.clearAttempt(attemptId);
        speakText('Exam submitted successfully.');
        onComplete(result);
      } catch (err) {
        submittingRef.current = false;
        if (err instanceof ApiError && err.isNetworkError) {
          setSubmitState('waiting-for-network');
          const message = 'You are offline. Your answers are saved on this device and will be submitted as soon as the connection returns.';
          setSubmitError(message);
          speakText(message);
        } else {
          setSubmitState('idle');
          const message = err instanceof ApiError ? err.message : 'Submission failed. Please try again.';
          setSubmitError(message);
          speakText(message);
        }
      }
    },
    [attemptId, onComplete, speakText, announceToScreenReader],
  );

  // Retry a submission that failed while offline.
  useEffect(() => {
    if (isOnline && submitState === 'waiting-for-network') void submitFinalExam('manual');
  }, [isOnline, submitState, submitFinalExam]);

  // Clock tick, time warnings and auto-submit.
  const warned = useRef<Set<number>>(new Set());
  const autoSubmitted = useRef(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + clockOffset), 1000);
    return () => window.clearInterval(timer);
  }, [clockOffset]);
  useEffect(() => {
    for (const w of TIME_WARNINGS) {
      if (timeLeft <= w && timeLeft > w - 5 && !warned.current.has(w)) {
        warned.current.add(w);
        const msg = `${w / 60} minute${w === 60 ? '' : 's'} remaining.`;
        announceToScreenReader(msg, 'assertive');
        speakText(msg);
      }
    }
    if (timeLeft === 0 && submitState === 'idle' && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submitFinalExam('timeout');
    }
  }, [timeLeft, submitState, submitFinalExam, announceToScreenReader, speakText]);

  const openSubmitModal = () => {
    setIsSubmitModalOpen(true);
    const unanswered = questions.length - Object.values(userAnswers).filter((a) => a.option !== null).length;
    speakText(
      `Confirm submission. ${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered. ` +
        'Say confirm submission or press Yes to submit, or say cancel to return to the exam.',
    );
  };

  // --- Voice & keyboard ---
  const { listening, supported: voiceSupported } = useVoiceCommands(
    {
      onHelp: speakShortcuts,
      onReadQuestion: repeatQuestion,
      onReadOptions: readOptions,
      onReadOption: readOption,
      onSelectOption: handleSelectOption,
      onNext: handleNext,
      onPrev: handlePrev,
      onSkip: handleSkip,
      onMark: handleMark,
      onTimeCheck: speakTimeLeft,
      onExplain: requestExplanation,
      onGoToQuestion: (num) => {
        if (num >= 1 && num <= questions.length) goTo(num - 1);
        else speakText(`There is no question ${num}.`);
      },
      onSubmit: openSubmitModal,
      onConfirm: () => {
        if (isSubmitModalOpen) void submitFinalExam('manual');
      },
      onCancel: () => {
        if (isSubmitModalOpen) {
          setIsSubmitModalOpen(false);
          speakText('Returned to the exam.');
        } else if (explanation) setExplanation(null);
      },
      onError: (error) => {
        if (Date.now() - lastVoiceErrorLog.current > 30_000) {
          lastVoiceErrorLog.current = Date.now();
          void serverApi.logBarrier(attemptId, 'voice_error', currentQ.id, { error });
        }
      },
    },
    submitState === 'idle',
  );

  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || isSubmitModalOpen) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [role="dialog"]')) return;
    const key = e.key.toLowerCase();
    const actions: Record<string, () => void> = {
      n: handleNext,
      p: handlePrev,
      r: repeatQuestion,
      o: readOptions,
      s: handleSkip,
      m: handleMark,
      t: speakTimeLeft,
      e: () => void requestExplanation(),
      h: speakShortcuts,
    };
    if (/^[1-6]$/.test(e.key)) {
      e.preventDefault();
      handleSelectOption(Number(e.key) - 1);
      return;
    }
    const action = actions[key];
    if (action) {
      e.preventDefault();
      action();
    }
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const answeredCount = Object.values(userAnswers).filter((a) => a.option !== null).length;
  const skippedCount = Object.values(userAnswers).filter((a) => a.option === null && a.skipped).length;
  const markedCount = Object.values(userAnswers).filter((a) => a.marked).length;
  const unansweredCount = questions.length - answeredCount;
  const currentState = userAnswers[currentQ.id];

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6 pt-16 flex flex-col gap-6" id="main-content">
      {/* Header Accessibility Navigation */}
      <header className="flex flex-wrap gap-4 justify-between items-center bg-slate-900 text-white p-4 rounded-xl">
        <h1 className="text-2xl font-bold outline-none" tabIndex={-1}>
          {exam.title} <span className="sr-only">— Formal Examination</span>
        </h1>
        <div className="flex items-center gap-4">
          {!isOnline && (
            <span role="status" className="px-3 py-1 bg-amber-500 text-black font-bold rounded">
              Offline — answers saved on this device
            </span>
          )}
          {isOnline && pendingCount > 0 && (
            <span role="status" className="px-3 py-1 bg-blue-500 text-black font-bold rounded">
              Syncing {pendingCount}…
            </span>
          )}
          {voiceSupported && (
            <span className={`px-3 py-1 rounded font-bold ${listening ? 'bg-green-500 text-black' : 'bg-slate-700 text-slate-300'}`}>
              {listening ? 'Voice: listening' : 'Voice: off'}
            </span>
          )}
          <div
            className={`text-2xl font-mono font-bold ${timeLeft <= 300 ? 'text-red-400' : ''}`}
            role="timer"
            aria-label={`Time remaining: ${spokenTime(timeLeft)}`}
          >
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      {/* Main Question Display */}
      <section className="bg-slate-800 text-white p-6 rounded-xl space-y-6" aria-labelledby="question-heading">
        <div className="flex flex-wrap gap-2 justify-between items-center border-b border-slate-700 pb-4">
          <h2 id="question-heading" ref={questionHeadingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
            Question {currentIndex + 1} of {questions.length}
            <span className="text-slate-300 font-normal">
              {' '}
              · {currentQ.marks} mark{currentQ.marks === 1 ? '' : 's'}
            </span>
          </h2>
          {currentState?.marked && <span className="bg-yellow-500 text-black px-3 py-1 font-bold rounded-md">MARKED FOR REVIEW</span>}
        </div>

        <p className="text-2xl font-medium leading-relaxed">{currentQ.questionText}</p>

        {currentQ.visualDescription && (
          <div className="bg-slate-700 p-4 rounded-lg border-l-4 border-blue-400">
            <span className="font-bold block text-blue-300">Visual content description:</span>
            <p className="text-xl">{currentQ.visualDescription}</p>
          </div>
        )}

        {/* Options List */}
        <div className="grid grid-cols-1 gap-4" role="radiogroup" aria-labelledby="question-heading">
          {currentQ.options.map((opt, idx) => {
            const isSelected = currentState?.option === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectOption(idx)}
                aria-checked={isSelected}
                role="radio"
                className={`p-4 text-left text-xl rounded-lg border-2 transition-all focus:ring-4 focus:ring-yellow-400 focus:outline-none flex items-center justify-between gap-4 ${
                  isSelected ? 'bg-blue-600 border-white font-bold' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                }`}
              >
                <span>
                  <strong className="mr-3">{letter(idx)}.</strong> {opt}
                </span>
                {isSelected && (
                  <span className="text-sm bg-white text-blue-900 px-2 py-1 rounded" aria-hidden="true">
                    Selected
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-700">
          <button onClick={handlePrev} disabled={currentIndex === 0} className="px-5 py-3 bg-gray-700 text-white text-lg font-bold rounded-lg disabled:opacity-50 focus:ring-4 focus:ring-yellow-400">
            Previous <span className="sr-only">(P)</span>
          </button>
          <button onClick={repeatQuestion} className="px-5 py-3 bg-slate-600 text-white text-lg font-bold rounded-lg focus:ring-4 focus:ring-yellow-400">
            Repeat <span className="sr-only">(R)</span>
          </button>
          <button onClick={handleSkip} className="px-5 py-3 bg-amber-600 text-white text-lg font-bold rounded-lg focus:ring-4 focus:ring-yellow-400">
            Skip Question <span className="sr-only">(S)</span>
          </button>
          <button onClick={handleMark} aria-pressed={Boolean(currentState?.marked)} className="px-5 py-3 bg-purple-600 text-white text-lg font-bold rounded-lg focus:ring-4 focus:ring-yellow-400">
            {currentState?.marked ? 'Unmark Review' : 'Mark for Review'} <span className="sr-only">(M)</span>
          </button>
          <button onClick={handleNext} disabled={currentIndex === questions.length - 1} className="px-5 py-3 bg-blue-600 text-white text-lg font-bold rounded-lg disabled:opacity-50 focus:ring-4 focus:ring-yellow-400">
            Next <span className="sr-only">(N)</span>
          </button>
          {exam.allowAiInExam && (
            <button
              onClick={() => void requestExplanation()}
              disabled={explanationLoading}
              className="px-5 py-3 bg-emerald-600 text-white text-lg font-bold rounded-lg focus:ring-4 focus:ring-yellow-400 sm:ml-auto disabled:opacity-60"
            >
              {explanationLoading ? 'Loading explanation…' : 'Explain Question'} <span className="sr-only">(E)</span>
            </button>
          )}
        </div>

        {explanation && (
          <div className="bg-emerald-950 border-2 border-emerald-400 rounded-lg p-4 space-y-2" role="region" aria-label="Explanation">
            <h3 className="text-xl font-bold text-emerald-300">Explanation</h3>
            <p className="text-xl whitespace-pre-line">{explanation.text}</p>
            <p className="text-lg text-emerald-200">
              {explanation.remaining} explanation{explanation.remaining === 1 ? '' : 's'} left for this question.
            </p>
            <button onClick={() => setExplanation(null)} className="px-4 py-2 bg-slate-700 rounded-lg font-bold">
              Close explanation
            </button>
          </div>
        )}
      </section>

      {/* Review & Skip Quick-Jump Dashboard */}
      <section className="bg-slate-900 text-white p-6 rounded-xl" aria-labelledby="nav-heading">
        <h2 id="nav-heading" className="text-xl font-bold mb-4">
          Question Status & Quick Jump
        </h2>
        <div className="flex flex-wrap gap-6 text-lg mb-4">
          <div>
            Answered: <strong className="text-green-400">{answeredCount}</strong>
          </div>
          <div>
            Skipped: <strong className="text-amber-400">{skippedCount}</strong>
          </div>
          <div>
            Marked: <strong className="text-purple-400">{markedCount}</strong>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {questions.map((q, idx) => {
            const state = userAnswers[q.id];
            const answered = state?.option !== null && state?.option !== undefined;
            let bg = 'bg-slate-700';
            if (answered) bg = 'bg-green-600';
            else if (state?.marked) bg = 'bg-purple-600';
            else if (state?.skipped) bg = 'bg-amber-600';
            const status = [answered ? 'Answered' : state?.skipped ? 'Skipped' : 'Unanswered', state?.marked ? 'marked for review' : '']
              .filter(Boolean)
              .join(', ');

            return (
              <button
                key={q.id}
                onClick={() => goTo(idx)}
                aria-label={`Question ${idx + 1}: ${status}`}
                aria-current={currentIndex === idx ? 'step' : undefined}
                className={`w-12 h-12 text-lg font-bold rounded-lg border-2 border-slate-500 focus:ring-4 focus:ring-yellow-400 ${bg} ${
                  currentIndex === idx ? 'ring-4 ring-yellow-400' : ''
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <button
          onClick={openSubmitModal}
          disabled={submitState !== 'idle'}
          className="mt-6 w-full py-4 bg-red-600 hover:bg-red-700 text-white text-2xl font-black rounded-xl focus:ring-4 focus:ring-yellow-400 disabled:opacity-60"
        >
          FINISH & SUBMIT EXAMINATION
        </button>
        {submitError && !isSubmitModalOpen && (
          <p role="alert" className="mt-4 text-xl font-semibold bg-amber-950 border-2 border-amber-400 p-4 rounded-lg">
            {submitError}
          </p>
        )}
      </section>

      {/* Final Accessible Submission Warning Modal */}
      {isSubmitModalOpen && (
        <SubmitDialog
          total={questions.length}
          answered={answeredCount}
          unanswered={unansweredCount}
          marked={markedCount}
          submitting={submitState !== 'idle'}
          error={submitError}
          onCancel={() => setIsSubmitModalOpen(false)}
          onConfirm={() => void submitFinalExam('manual')}
        />
      )}
    </main>
  );
};

const SubmitDialog: React.FC<{
  total: number;
  answered: number;
  unanswered: number;
  marked: number;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ total, answered, unanswered, marked, submitting, error, onCancel, onConfirm }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => previousFocus.current?.focus();
  }, []);

  // Keep focus inside the dialog and close it on Escape.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-desc"
        onKeyDown={onKeyDown}
        className="bg-slate-800 text-white p-8 rounded-2xl max-w-xl w-full border-4 border-yellow-400 space-y-6"
      >
        <h2 id="modal-title" className="text-3xl font-extrabold text-yellow-400">
          Confirm Examination Submission
        </h2>
        <div id="modal-desc" className="text-xl space-y-2">
          <p>
            Total Questions: <strong>{total}</strong>
          </p>
          <p className="text-green-400">
            Answered: <strong>{answered}</strong>
          </p>
          <p className="text-amber-400">
            Unanswered: <strong>{unanswered}</strong>
          </p>
          <p className="text-purple-400">
            Marked for Review: <strong>{marked}</strong>
          </p>
          {unanswered > 0 && (
            <p className="text-amber-300 font-semibold bg-amber-950 p-4 rounded-lg">
              Warning: {unanswered} question{unanswered === 1 ? ' is' : 's are'} unanswered. You can return to review them now.
            </p>
          )}
          <p>You cannot change your answers after submitting.</p>
        </div>
        {error && (
          <p role="alert" className="text-lg font-semibold bg-amber-950 border-2 border-amber-400 p-3 rounded-lg">
            {error}
          </p>
        )}
        <div className="flex gap-4 pt-4">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-xl font-bold rounded-lg focus:ring-4 focus:ring-yellow-400"
          >
            Return to Exam
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-xl font-bold rounded-lg focus:ring-4 focus:ring-yellow-400 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Yes, Submit Now'}
          </button>
        </div>
      </div>
    </div>
  );
};
