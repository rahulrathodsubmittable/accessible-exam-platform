import { useEffect, useRef } from 'react';
import { VoiceAssistantEngine } from '../services/voice/speechToText';
import { useAccessibility } from '../contexts/AccessibilityContext';

export const useVoiceCommands = (handlers: {
  onReadQuestion?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSkip?: () => void;
  onMark?: () => void;
  onSelectOption?: (optionLetter: string) => void;
  onTimeCheck?: () => void;
  onExplain?: () => void;
  onGoToQuestion?: (qNum: string) => void;
}) => {
  const { speakText } = useAccessibility();
  const engineRef = useRef<VoiceAssistantEngine | null>(null);

  useEffect(() => {
    const engine = new VoiceAssistantEngine('en-US');

    engine.registerCommand(/read question|repeat question/i, () => {
      speakText('Reading question...');
      handlers.onReadQuestion?.();
    });

    engine.registerCommand(/next question|go next/i, () => {
      speakText('Going to next question.');
      handlers.onNext?.();
    });

    engine.registerCommand(/previous question|go back/i, () => {
      speakText('Going to previous question.');
      handlers.onPrev?.();
    });

    engine.registerCommand(/skip question|skip this/i, () => {
      speakText('Question skipped.');
      handlers.onSkip?.();
    });

    engine.registerCommand(/mark for review|mark question/i, () => {
      speakText('Question marked for review.');
      handlers.onMark?.();
    });

    engine.registerCommand(/select option ([a-d])/i, (_, option) => {
      speakText(`Option ${option.toUpperCase()} selected.`);
      handlers.onSelectOption?.(option.toUpperCase());
    });

    engine.registerCommand(/read option ([a-d])/i, (_, option) => {
      handlers.onSelectOption?.(option.toUpperCase());
    });

    engine.registerCommand(/how much time is left|check time/i, () => {
      handlers.onTimeCheck?.();
    });

    engine.registerCommand(/explain question|explain this/i, () => {
      handlers.onExplain?.();
    });

    engine.registerCommand(/go to question (\d+)/i, (_, qNum) => {
      speakText(`Jumping to question ${qNum}`);
      handlers.onGoToQuestion?.(qNum);
    });

    engine.start();
    engineRef.current = engine;

    return () => {
      engine.stop();
    };
  }, [handlers]);
};