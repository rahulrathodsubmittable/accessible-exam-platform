import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AccessibilitySettings {
  fontSize: 'small' | 'medium' | 'large' | 'x-large';
  fontFamily: string;
  lineSpacing: 'normal' | 'relaxed' | 'double';
  highContrast: boolean;
  darkMode: boolean;
  reducedMotion: boolean;
  speechRate: number;
  speechPitch: number;
  language: string;
  voiceEnabled: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  speakText: (text: string, onEnd?: () => void) => void;
  stopSpeech: () => void;
}

const defaultSettings: AccessibilitySettings = {
  fontSize: 'medium',
  fontFamily: 'system-ui, sans-serif',
  lineSpacing: 'normal',
  highContrast: false,
  darkMode: false,
  reducedMotion: false,
  speechRate: 1.0,
  speechPitch: 1.0,
  language: 'en-US',
  voiceEnabled: true,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    const saved = localStorage.getItem('accessibility_prefs');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const [announcement, setAnnouncement] = useState<{ message: string; priority: 'polite' | 'assertive' }>({
    message: '',
    priority: 'polite',
  });

  useEffect(() => {
    localStorage.setItem('accessibility_prefs', JSON.stringify(settings));
    document.documentElement.classList.toggle('high-contrast', settings.highContrast);
    document.documentElement.classList.toggle('dark', settings.darkMode);
    document.documentElement.setAttribute('data-font-size', settings.fontSize);
  }, [settings]);

  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    announceToScreenReader('Accessibility settings updated.');
  };

  const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement({ message, priority });
  };

  const speakText = (text: string, onEnd?: () => void) => {
    if (!settings.voiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.speechRate;
    utterance.pitch = settings.speechPitch;
    utterance.lang = settings.language;
    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <AccessibilityContext.Provider value={{ settings, updateSettings, announceToScreenReader, speakText, stopSpeech }}>
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