import React, { useState } from 'react';
import { HomePage } from './pages/Home/HomePage';
import { ExamVerification } from './pages/ExamVerification/ExamVerification';
import { ExamEngine } from './pages/Exam/ExamEngine';
import { PracticeEngine } from './pages/Practice/PracticeEngine';
import { ResultPage } from './pages/Result/ResultPage';
import { TeacherDashboard } from './pages/Teacher/TeacherDashboard';
import { AccessibilityControlCenter } from './components/accessibility/AccessibilityControlCenter';
import { AccessibilitySettings, Candidate, Exam } from './types';

export const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<'home' | 'verify' | 'exam' | 'practice' | 'result' | 'teacher'>('home');
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [totalMarks, setTotalMarks] = useState<number>(0);

  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>({
    fontSize: 'large',
    highContrast: true,
    voiceSpeed: 1.0,
    voicePitch: 1.0,
    language: 'English',
    screenReaderOptimized: true,
  });

  const handleVerificationSuccess = (candidate: Candidate, exam: Exam) => {
    setActiveCandidate(candidate);
    setActiveExam(exam);
    setCurrentMode('exam');
  };

  const handleExamComplete = (score: number, total: number) => {
    setFinalScore(score);
    setTotalMarks(total);
    setCurrentMode('result');
  };

  return (
    <div className={`min-h-screen ${accessibilitySettings.highContrast ? 'bg-black text-yellow-300' : 'bg-slate-900 text-white'}`}>
      {/* Floating Global Accessibility Bar */}
      <AccessibilityControlCenter
        settings={accessibilitySettings}
        onUpdateSettings={setAccessibilitySettings}
      />

      {currentMode === 'home' && (
        <HomePage
          onSelectExamMode={() => setCurrentMode('verify')}
          onSelectPracticeMode={() => setCurrentMode('practice')}
          onSelectTeacherMode={() => setCurrentMode('teacher')}
        />
      )}

      {currentMode === 'verify' && (
        <ExamVerification
          onVerified={handleVerificationSuccess}
          onBack={() => setCurrentMode('home')}
        />
      )}

      {currentMode === 'exam' && activeCandidate && activeExam && (
        <ExamEngine
          candidate={activeCandidate}
          exam={activeExam}
          settings={accessibilitySettings}
          onComplete={handleExamComplete}
        />
      )}

      {currentMode === 'practice' && (
        <PracticeEngine
          settings={accessibilitySettings}
          onBackToHome={() => setCurrentMode('home')}
        />
      )}

      {currentMode === 'result' && activeCandidate && (
        <ResultPage
          candidateName={activeCandidate.full_name}
          score={finalScore}
          totalMarks={totalMarks}
          onReturnHome={() => setCurrentMode('home')}
        />
      )}

      {currentMode === 'teacher' && (
        <TeacherDashboard onBackToHome={() => setCurrentMode('home')} />
      )}
    </div>
  );
};

export default App;