import React, { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';
import { ExamManager } from '../components/teacher/ExamManager';
import { CandidateIdGenerator } from '../components/teacher/CandidateIdGenerator';
import { PaperImprovementPanel } from '../components/teacher/PaperImprovementPanel';
import { DocumentOCRAnalyzer } from '../components/teacher/DocumentOCRAnalyzer';
import { BarrierReplayViewer } from '../components/teacher/BarrierReplayViewer';
import { inputClass, labelClass, primaryButton, secondaryButton } from '../components/teacher/useTeacherExams';

interface Props {
  onBackToHome: () => void;
}

const TABS = [
  { id: 'exams', label: 'Exams & Questions', Component: ExamManager },
  { id: 'candidates', label: 'Candidate IDs', Component: CandidateIdGenerator },
  { id: 'paper', label: 'AI Paper Improvement', Component: PaperImprovementPanel },
  { id: 'ocr', label: 'Vision & OCR', Component: DocumentOCRAnalyzer },
  { id: 'barriers', label: 'Barrier Replay', Component: BarrierReplayViewer },
] as const;

type TabId = (typeof TABS)[number]['id'];

const Shell: React.FC<{ onBackToHome: () => void; children: React.ReactNode; actions?: React.ReactNode }> = ({
  onBackToHome,
  children,
  actions,
}) => (
  <main id="main-content" className="min-h-screen p-4 sm:p-8 pt-16">
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap gap-4 justify-between items-center border-b-4 border-slate-700 pb-4">
        <h1 className="text-4xl font-black text-yellow-400 outline-none" tabIndex={-1}>
          Teacher / Admin Portal
        </h1>
        <div className="flex gap-3">
          {actions}
          <button onClick={onBackToHome} className={secondaryButton}>
            ← Home
          </button>
        </div>
      </header>
      {children}
    </div>
  </main>
);

export const TeacherDashboard: React.FC<Props> = ({ onBackToHome }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isTeacher, setIsTeacher] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!supabase || !userId) {
      setIsTeacher(null);
      return;
    }
    supabase
      .from('teachers')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setIsTeacher(Boolean(data)));
  }, [userId]);

  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell onBackToHome={onBackToHome}>
        <p role="alert" className="text-xl bg-amber-950 border-2 border-amber-400 p-4 rounded-lg">
          The Teacher portal needs Supabase. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> and redeploy.
        </p>
      </Shell>
    );
  }

  if (!authReady) {
    return (
      <Shell onBackToHome={onBackToHome}>
        <p role="status" className="text-xl">
          Loading…
        </p>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell onBackToHome={onBackToHome}>
        <LoginForm />
      </Shell>
    );
  }

  const signOut = (
    <button onClick={() => void supabase?.auth.signOut()} className={secondaryButton}>
      Sign out
    </button>
  );

  if (isTeacher === null) {
    return (
      <Shell onBackToHome={onBackToHome} actions={signOut}>
        <p role="status" className="text-xl">
          Checking your access…
        </p>
      </Shell>
    );
  }

  if (!isTeacher) {
    return (
      <Shell onBackToHome={onBackToHome} actions={signOut}>
        <div role="alert" className="text-xl bg-amber-950 border-2 border-amber-400 p-4 rounded-lg space-y-2">
          <p>
            You are signed in as <strong>{session.user.email}</strong>, but this account is not registered as a teacher.
          </p>
          <p>An administrator can add it by inserting your user id into the <code>teachers</code> table (see the README).</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell onBackToHome={onBackToHome} actions={signOut}>
      <Tabs />
    </Shell>
  );
};

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError(err.message);
  };

  return (
    <form onSubmit={submit} className="max-w-md bg-slate-900 border-2 border-slate-700 rounded-xl p-6 space-y-4">
      <h2 className="text-2xl font-bold">Teacher sign in</h2>
      <div>
        <label htmlFor="t-email" className={labelClass}>
          Email
        </label>
        <input id="t-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="t-password" className={labelClass}>
          Password
        </label>
        <input
          id="t-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && (
        <p role="alert" className="text-lg text-red-300">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className={`${primaryButton} w-full`}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
};

const Tabs: React.FC = () => {
  const [active, setActive] = useState<TabId>('exams');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    setActive(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const ActiveComponent = TABS.find((t) => t.id === active)!.Component;

  return (
    <div>
      <div role="tablist" aria-label="Teacher tools" className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`px-4 py-3 text-lg font-bold rounded-lg border-2 ${
              active === tab.id ? 'bg-yellow-400 text-black border-yellow-200' : 'bg-slate-800 border-slate-600 hover:border-yellow-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} tabIndex={0}>
        <ActiveComponent />
      </div>
    </div>
  );
};
