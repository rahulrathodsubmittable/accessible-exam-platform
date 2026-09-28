import { useEffect, useRef, useState } from 'react';
import { VoiceAssistantEngine } from '../services/voice/speechToText';
import { useAccessibility } from '../contexts/AccessibilityContext';

export interface VoiceCommandHandlers {
  onReadQuestion?: () => void;
  onReadOptions?: () => void;
  onReadOption?: (optionIndex: number) => void;
  onSelectOption?: (optionIndex: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSkip?: () => void;
  onMark?: () => void;
  onTimeCheck?: () => void;
  onExplain?: () => void;
  onGoToQuestion?: (questionNumber: number) => void;
  onSubmit?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onHelp?: () => void;
  onError?: (error: string) => void;
}

// Speech recognisers often hear option letters as words.
const LETTER_WORDS: Record<string, number> = {
  a: 0, ay: 0, eh: 0, one: 0, '1': 0,
  b: 1, be: 1, bee: 1, two: 1, '2': 1,
  c: 2, see: 2, sea: 2, three: 2, '3': 2,
  d: 3, de: 3, dee: 3, four: 3, '4': 3,
  e: 4, five: 4, '5': 4,
  f: 5, ef: 5, six: 5, '6': 5,
};
const LETTER = '(a|ay|eh|b|be|bee|c|see|sea|d|de|dee|e|f|ef|one|two|three|four|five|six|[1-6])';

/**
 * Listens for spoken exam commands while `enabled` is true.
 * Handlers are read from a ref, so passing a new object each render is fine.
 */
export const useVoiceCommands = (handlers: VoiceCommandHandlers, enabled: boolean) => {
  const { settings, speakText } = useAccessibility();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [listening, setListening] = useState(false);
  const supported = VoiceAssistantEngine.isSupported();

  useEffect(() => {
    if (!enabled || !settings.voiceCommandsEnabled || !supported) {
      setListening(false);
      return;
    }

    const h = () => handlersRef.current;
    const engine = new VoiceAssistantEngine(
      settings.language,
      (error) => {
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          setListening(false);
          speakText('Microphone access was blocked, so voice commands are off. You can still use the keyboard.');
        }
        h().onError?.(error);
      },
    );

    engine.registerCommand(/\b(help|what can i say|list commands)\b/, () => h().onHelp?.());
    engine.registerCommand(/\b(read|repeat) (the )?question\b/, () => h().onReadQuestion?.());
    engine.registerCommand(/\bread (all )?(the )?options\b/, () => h().onReadOptions?.());
    engine.registerCommand(new RegExp(`\\bread option ${LETTER}\\b`), (_, letter) => {
      if (letter) h().onReadOption?.(LETTER_WORDS[letter]);
    });
    engine.registerCommand(new RegExp(`\\b(?:select|choose|answer|pick) (?:option )?${LETTER}\\b`), (_, letter) => {
      if (letter) h().onSelectOption?.(LETTER_WORDS[letter]);
    });
    engine.registerCommand(/\b(next question|go next|next)\b/, () => h().onNext?.());
    engine.registerCommand(/\b(previous question|go back|previous)\b/, () => h().onPrev?.());
    engine.registerCommand(/\b(skip question|skip this|skip)\b/, () => h().onSkip?.());
    engine.registerCommand(/\b(mark for review|mark question|unmark)\b/, () => h().onMark?.());
    engine.registerCommand(/\b(how much time|time left|check time)\b/, () => h().onTimeCheck?.());
    engine.registerCommand(/\b(explain question|explain this|explain)\b/, () => h().onExplain?.());
    engine.registerCommand(/\bgo to question (\d+)\b/, (_, num) => {
      if (num) h().onGoToQuestion?.(parseInt(num, 10));
    });
    engine.registerCommand(/\b(confirm submission|yes submit|confirm)\b/, () => h().onConfirm?.());
    engine.registerCommand(/\b(submit exam|finish exam|submit)\b/, () => h().onSubmit?.());
    engine.registerCommand(/\b(cancel|close|return to exam)\b/, () => h().onCancel?.());

    engine.start();
    setListening(true);
    return () => {
      engine.stop();
      setListening(false);
    };
  }, [enabled, settings.voiceCommandsEnabled, settings.language, supported, speakText]);

  return { listening, supported };
};
