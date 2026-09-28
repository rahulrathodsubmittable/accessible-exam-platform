export type * from '../../shared/types';

export type FontSize = 'medium' | 'large' | 'x-large' | 'xx-large';

export interface AccessibilitySettings {
  fontSize: FontSize;
  highContrast: boolean;
  reducedMotion: boolean;
  /** Spoken output (text-to-speech). */
  voiceEnabled: boolean;
  /** Spoken commands (speech recognition) during exams and practice. */
  voiceCommandsEnabled: boolean;
  speechRate: number;
  speechPitch: number;
  language: string;
}

export interface AnswerState {
  option: number | null;
  skipped: boolean;
  marked: boolean;
}
