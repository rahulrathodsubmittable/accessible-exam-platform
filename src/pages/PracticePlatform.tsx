import React, { useState, useEffect } from 'react';
import { Question, AccessibilitySettings } from '../../types';
import { voiceEngine } from '../../services/voice/voiceEngine';
import { getAIQuestionExplanation } from '../../services/ai/aiServices';

interface Props {
  settings: AccessibilitySettings;
  onBackToHome: () => void;
}

export const PracticeEngine: React.FC<Props> = ({ settings, onBackToHome }) => {
  const [selectedSubject, setSelectedSubject] = useState('Computer Science');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  useEffect(() => {
    // Mock practice dataset
    const samplePracticeQs: Question[] = [
      {
        id: 'p-1',
        exam_id: 'practice-mode',
        question_text: 'Which data structure is best suited for implementing a LIFO (Last-In, First-Out) stack behavior?',
        question_type: 'mcq',
        difficulty: 'easy',
        subject: 'Computer Science',
        topic: 'Stacks',
        marks: 1,
        order_index: 1,
        explanation_text: 'Stacks explicitly restrict access so that the most recently added item is popped first.',
        options: [
          { id: 'po1', question_id: 'p-1', option_key: 'A', option_text: 'Array-based Stack' },
          { id: 'po2', question_id: 'p-1', option_key: 'B', option_text: 'Queue' },
          { id: 'po3', question_id: 'p-1', option_key: 'C', option_text: 'Binary Search Tree' },
          { id: 'po4', question_id: 'p-1', option_key: 'D', option_text: 'Graph' }
        ]
      }
    ];
    setQuestions(samplePracticeQs);
  }, [selectedSubject]);

  const currentQ = questions[currentIndex];

  const handleSelectOption = (optId: string) => {
    setSelectedOption(optId);
    setIsAnswered(true);
    voiceEngine.speak(`Option selected. Press Explain Question to get instant AI practice guidance.`);
  };

  const handleGetExplanation = async () => {
    if (!currentQ) return;
    voiceEngine.speak('Generating AI practice explanation...');
    const explanation = await getAIQuestionExplanation(
      currentQ.question_text,
      currentQ.options.map((o) => `${o.option_key}: ${o.option_text}`),
      currentQ.subject
    );
    setAiExplanation(explanation);
    voiceEngine.speak(explanation);
  };

  if (!currentQ) {
    return <div className="p-8 text-2xl text-white">Loading Practice Material...</div>;
  }

  return (
    <div className={`min-h-screen p-8 ${settings.highContrast ? 'bg-black text-yellow-300' : 'bg-slate-900 text-white'}`}>
      <header className="flex justify-between items-center border-b-4 border-slate-700 pb-4 mb-6">
        <div>
          <h1 className="text-4xl font-black text-yellow-400">Interactive Practice Mode</h1>
          <p className="text-xl text-slate-300">Subject: {selectedSubject} — Adaptive Practice Learning</p>
        </div>
        <button
          onClick={onBackToHome}
          className="px-6 py-3 bg-slate-800 text-white font-bold text-xl rounded border-2 border-slate-600 hover:border-yellow-400"
        >
          ← Exit Practice
        </button>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        <div className="p-6 bg-slate-800 border-2 border-slate-700 rounded-xl space-y-4">
          <span className="text-lg uppercase tracking-wider font-bold text-yellow-400">
            Practice Item {currentIndex + 1} of {questions.length}
          </span>
          <h2 className="text-3xl font-bold">{currentQ.question_text}</h2>

          <div className="space-y-4 pt-4">
            {currentQ.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleSelectOption(opt.id)}
                className={`w-full p-5 text-left text-2xl font-bold rounded border-4 transition ${
                  selectedOption === opt.id
                    ? 'bg-yellow-400 text-black border-white'
                    : 'bg-slate-900 text-white border-slate-700 hover:border-yellow-400'
                }`}
              >
                Option {opt.option_key}: {opt.option_text}
              </button>
            ))}
          </div>
        </div>

        {/* AI PRACTICE ASSISTANT PANEL */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleGetExplanation}
            className="px-8 py-4 bg-purple-700 hover:bg-purple-600 text-2xl font-bold rounded focus:ring-4 focus:ring-white"
          >
            💡 Get AI Practice Explanation
          </button>
        </div>

        {aiExplanation && (
          <div className="p-6 bg-slate-800 border-4 border-green-500 rounded-xl text-2xl text-green-300" tabIndex={0}>
            <h3 className="font-bold text-green-400 mb-2">Practice Learning Tip & Concept Breakdown:</h3>
            <p className="whitespace-pre-line">{aiExplanation}</p>
          </div>
        )}
      </main>
    </div>
  );
};