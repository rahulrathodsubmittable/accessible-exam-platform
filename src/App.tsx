import React, { useEffect, useRef, useState } from 'react';
import { HomePage } from './pages/Home';
import { ExamVerification } from './pages/Verification';
import { ExamInstructions } from './pages/ExamInstructions';
import { ExamPlatform } from './pages/ExamPlatform';
import { PracticeEngine } from './pages/PracticePlatform';
import { ResultPage } from './pages/Results';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { AccessibilityControlCenter } from './components/accessibility/AccessibilityControlCenter';
import type { ExamSession, SubmitResult, VerifyResult } from './types';

type Screen = 'home' | 'verify' | 'instructions' | 'exam' | 'practice' | 'result' | 'teacher';

const TITLES: Record<Screen, string> = {
  home: 'Home',
  verify: 'Enter Candidate ID',
  instructions: 'Exam Instructions',
  exam: 'Examination in Progress',
  practice: 'Practice Mode',
  result: 'Exam Results',
  teacher: 'Teacher Portal',
};

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('home');
  const [verified, setVerified] = useState<VerifyResult | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const isFirstRender = useRef(true);

  // Give each screen a title and move focus to its heading, like a page load would.
  useEffect(() => {
    document.title = `${TITLES[screen]} · AI Accessible Exam Platform`;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus());
  }, [screen]);

  const goHome = () => {
    setVerified(null);
    setSession(null);
    setResult(null);
    setScreen('home');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <a
        href="#main-content"
        className="sr-only-focusable fixed top-3 left-3 z-50 bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg"
      >
        Skip to main content
      </a>

      {/* Floating Global Accessibility Bar */}
      <AccessibilityControlCenter />

      {screen === 'home' && (
        <HomePage
          onSelectExamMode={() => setScreen('verify')}
          onSelectPracticeMode={() => setScreen('practice')}
          onSelectTeacherMode={() => setScreen('teacher')}
        />
      )}

      {screen === 'verify' && (
        <ExamVerification
          onVerified={(v) => {
            setVerified(v);
            setScreen('instructions');
          }}
          onBack={goHome}
        />
      )}

      {screen === 'instructions' && verified && (
        <ExamInstructions
          verified={verified}
          onStarted={(s) => {
            setSession(s);
            setScreen('exam');
          }}
          onBack={goHome}
        />
      )}

      {screen === 'exam' && session && (
        <ExamPlatform
          session={session}
          onComplete={(r) => {
            setResult(r);
            setScreen('result');
          }}
        />
      )}

      {screen === 'practice' && <PracticeEngine onBackToHome={goHome} />}

      {screen === 'result' && session && result && (
        <ResultPage
          candidateName={session.candidate.fullName}
          examTitle={session.exam.title}
          attemptId={session.attempt.id}
          result={result}
          onReturnHome={goHome}
        />
      )}

      {screen === 'teacher' && <TeacherDashboard onBackToHome={goHome} />}
    </div>
  );
};

export default App;
