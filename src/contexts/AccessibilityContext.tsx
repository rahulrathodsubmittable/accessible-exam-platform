import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AccessibilitySettings } from '../types';

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  speakText: (text: string, onEnd?: () => void) => void;
  stopSpeech: () => void;
}

const STORAGE_KEY = 'accessibility_prefs';

const defaultSettings: AccessibilitySettings = {
  fontSize: 'large',
  highContrast: false,
  reducedMotion: false,
  voiceEnabled: true,
  voiceCommandsEnabled: true,
  speechRate: 1.0,
  speechPitch: 1.0,
  language: 'en-US',
};

function loadSettings(): AccessibilitySettings {
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const base = { ...defaultSettings, reducedMotion: Boolean(prefersReducedMotion) };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...base, ...(JSON.parse(saved) as Partial<AccessibilitySettings>) } : base;
  } catch {
    return base;
  }
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [announcement, setAnnouncement] = useState<{ message: string; priority: 'polite' | 'assertive' }>({
    message: '',
    priority: 'polite',
  });
  const announceTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage can be unavailable (private mode); settings still apply for this visit.
    }
    const root = document.documentElement;
    root.classList.toggle('high-contrast', settings.highContrast);
    root.classList.toggle('reduced-motion', settings.reducedMotion);
    root.setAttribute('data-font-size', settings.fontSize);
    root.lang = settings.language.split('-')[0] || 'en';
  }, [settings]);

  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Clear first so repeating the same message is announced again.
    window.clearTimeout(announceTimer.current);
    setAnnouncement({ message: '', priority });
    announceTimer.current = window.setTimeout(() => setAnnouncement({ message, priority }), 60);
  }, []);

  const updateSettings = useCallback(
    (newSettings: Partial<AccessibilitySettings>) => {
      setSettings((prev) => ({ ...prev, ...newSettings }));
      announceToScreenReader('Accessibility settings updated.');
    },
    [announceToScreenReader],
  );

  const speakText = useCallback((text: string, onEnd?: () => void) => {
    const current = settingsRef.current;
    if (!current.voiceEnabled || !('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = current.speechRate;
    utterance.pitch = current.speechPitch;
    utterance.lang = current.language;
    if (onEnd) utterance.onend = () => onEnd();
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeech = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings, announceToScreenReader, speakText, stopSpeech }),
    [settings, updateSettings, announceToScreenReader, speakText, stopSpeech],
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      {/* Dynamic Screen Reader Live Regions */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement.priority === 'polite' ? announcement.message : ''}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement.priority === 'assertive' ? announcement.message : ''}
      </div>
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return context;
};
