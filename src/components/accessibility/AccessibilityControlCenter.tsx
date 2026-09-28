import React, { useEffect, useRef, useState } from 'react';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import type { FontSize } from '../../types';

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'medium', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'x-large', label: 'Extra large' },
  { value: 'xx-large', label: 'Huge' },
];

const Toggle: React.FC<{ id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({
  id,
  label,
  checked,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4">
    <label htmlFor={id} className="text-lg font-semibold">
      {label}
    </label>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`min-w-20 px-3 py-2 rounded-lg font-bold border-2 ${
        checked ? 'bg-yellow-400 text-black border-yellow-200' : 'bg-slate-700 text-white border-slate-500'
      }`}
    >
      {checked ? 'On' : 'Off'}
    </button>
  </div>
);

/** Floating accessibility settings panel, available on every screen (Alt + A). */
export const AccessibilityControlCenter: React.FC = () => {
  const { settings, updateSettings, speakText } = useAccessibility();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'KeyA') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('button, select, input')?.focus();
  }, [open]);

  return (
    <div className="fixed top-3 right-3 z-40">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="a11y-panel"
        className="px-4 py-2 bg-yellow-400 text-black font-black rounded-lg border-2 border-black shadow-lg focus:ring-4 focus:ring-white"
      >
        Accessibility <span className="sr-only">settings, shortcut Alt plus A</span>
      </button>

      {open && (
        <div
          id="a11y-panel"
          ref={panelRef}
          role="dialog"
          aria-label="Accessibility settings"
          className="mt-2 w-[min(92vw,24rem)] bg-slate-900 text-white border-4 border-yellow-400 rounded-xl p-5 space-y-4 shadow-2xl"
        >
          <h2 className="text-2xl font-black text-yellow-400">Accessibility</h2>

          <div className="space-y-2">
            <label htmlFor="a11y-font" className="text-lg font-semibold block">
              Text size
            </label>
            <select
              id="a11y-font"
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: e.target.value as FontSize })}
              className="w-full bg-slate-800 border-2 border-slate-600 rounded-lg p-2 text-lg"
            >
              {FONT_SIZES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <Toggle id="a11y-contrast" label="High contrast" checked={settings.highContrast} onChange={(v) => updateSettings({ highContrast: v })} />
          <Toggle id="a11y-motion" label="Reduce motion" checked={settings.reducedMotion} onChange={(v) => updateSettings({ reducedMotion: v })} />
          <Toggle id="a11y-voice" label="Spoken output" checked={settings.voiceEnabled} onChange={(v) => updateSettings({ voiceEnabled: v })} />
          <Toggle
            id="a11y-commands"
            label="Voice commands"
            checked={settings.voiceCommandsEnabled}
            onChange={(v) => updateSettings({ voiceCommandsEnabled: v })}
          />

          <div className="space-y-1">
            <label htmlFor="a11y-rate" className="text-lg font-semibold block">
              Speech speed: {settings.speechRate.toFixed(1)}×
            </label>
            <input
              id="a11y-rate"
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.speechRate}
              onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })}
              className="w-full accent-yellow-400"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="a11y-pitch" className="text-lg font-semibold block">
              Voice pitch: {settings.speechPitch.toFixed(1)}
            </label>
            <input
              id="a11y-pitch"
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.speechPitch}
              onChange={(e) => updateSettings({ speechPitch: Number(e.target.value) })}
              className="w-full accent-yellow-400"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => speakText('This is how questions will sound.')}
              className="flex-1 py-2 bg-slate-700 border-2 border-slate-500 rounded-lg font-bold"
            >
              Test voice
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
              className="flex-1 py-2 bg-yellow-400 text-black rounded-lg font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
