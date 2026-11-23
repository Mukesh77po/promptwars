import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Bell, Moon, Sun } from 'lucide-react';
import type { Notification, User } from './shared/types.ts';
import { api } from './api.ts';
import { errorMessage } from './format.ts';
import { Discover } from './components/Discover.tsx';
import { SignIn } from './components/SignIn.tsx';
import { Loading, Notice } from './components/ui.tsx';

const StudentRequests = lazy(() =>
  import('./components/StudentRequests.tsx').then((m) => ({ default: m.StudentRequests })),
);
const MyBookings = lazy(() =>
  import('./components/MyBookings.tsx').then((m) => ({ default: m.MyBookings })),
);
const Approvals = lazy(() =>
  import('./components/Approvals.tsx').then((m) => ({ default: m.Approvals })),
);
const Resolver = lazy(() =>
  import('./components/Resolver.tsx').then((m) => ({ default: m.Resolver })),
);
const CampusMap = lazy(() =>
  import('./components/CampusMap.tsx').then((m) => ({ default: m.CampusMap })),
);
const Dashboard = lazy(() =>
  import('./components/Dashboard.tsx').then((m) => ({ default: m.Dashboard })),
);

type View = 'discover' | 'map' | 'requests' | 'bookings' | 'approvals' | 'resolve' | 'utilisation';

const NAV: Record<User['role'], { id: View; label: string }[]> = {
  student: [
    { id: 'discover', label: 'Discover' },
    { id: 'map', label: 'Campus map' },
    { id: 'requests', label: 'Project requests' },
    { id: 'bookings', label: 'My bookings' },
  ],
  faculty: [
    { id: 'approvals', label: 'Approvals' },
    { id: 'resolve', label: 'Resolve conflicts' },
    { id: 'utilisation', label: 'Utilisation' },
    { id: 'discover', label: 'Discover' },
    { id: 'map', label: 'Campus map' },
  ],
};

const todayLocal = () => new Date().toLocaleDateString('en-CA');

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('discover');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const loadNotifications = useCallback(() => {
    api
      .notifications()
      .then((r) => setNotifications(r.notifications))
      .catch(() => setNotifications([]));
  }, []);

  const loadSession = useCallback(() => {
    api
      .session()
      .then((s) => {
        setUser(s.user);
        setAiEnabled(s.aiEnabled);
        if (s.user) {
          setView(NAV[s.user.role][0]!.id);
          loadNotifications();
        }
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setReady(true));
  }, [loadNotifications]);

  useEffect(loadSession, [loadSession]);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user, view, loadNotifications]);

  useEffect(() => {
    document.getElementById('page-title')?.focus();
  }, [view]);

  const signOut = () => {
    setShowNotifs(false);
    void api.signOut().then(() => setUser(null));
  };

  const signedOut = ready && !user;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-teal-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <a
            href="#main"
            onClick={(e) => {
              if (user) {
                e.preventDefault();
                setView(NAV[user.role][0]!.id);
              }
            }}
            className="font-display text-xl font-bold tracking-tight whitespace-nowrap shrink-0 text-slate-900 dark:text-slate-100"
          >
            LabLink
          </a>

          {user ? (
            <nav aria-label="Primary" className="hidden md:flex items-center gap-6 overflow-x-auto">
              {NAV[user.role].map((item) => {
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setView(item.id)}
                    className={`relative py-5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'text-teal-700 dark:text-teal-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-teal-700 dark:bg-teal-400" />
                    )}
                  </button>
                );
              })}
            </nav>
          ) : (
            <nav aria-label="Overview" className="hidden md:flex items-center gap-6">
              <a
                href="#accounts"
                className="text-sm font-medium whitespace-nowrap shrink-0 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Student Profiles
              </a>
              <a
                href="#accounts"
                className="text-sm font-medium whitespace-nowrap shrink-0 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Faculty Console
              </a>
            </nav>
          )}

          <div className="shrink-0">
            {user ? (
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 text-slate-800 transition-colors hover:border-teal-600 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Switch user
              </button>
            ) : (
              <a
                href="#accounts"
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 text-white transition-colors hover:bg-teal-800 dark:bg-teal-600"
              >
                Select account
              </a>
            )}
          </div>
        </div>
      </header>

      {user && (
        <div className="border-b border-slate-200 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{user.name}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{user.role}</span>
              <span className="md:hidden" aria-hidden="true">
                ·
              </span>
              <div className="flex flex-wrap gap-2 md:hidden">
                {NAV[user.role].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setView(item.id)}
                    className={`rounded px-2 py-1 text-xs font-medium whitespace-nowrap ${
                      view === item.id
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowNotifs((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <Bell className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                <span className="tabular-nums">Alerts ({notifications.length})</span>
              </button>

              <button
                type="button"
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {theme === 'dark' ? (
                  <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
            </div>
          </div>

          {showNotifs && (
            <div className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No active alerts for your account.
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <Notice tone={n.tone}>
                          <p className="font-semibold">{n.title}</p>
                          <p className="mt-0.5 text-xs opacity-90">{n.detail}</p>
                        </Notice>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Notice tone="bad">{error}</Notice>
        </div>
      )}

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {signedOut ? (
          <SignIn onSignedIn={loadSession} theme={theme} />
        ) : (
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {ready ? (
              <Suspense fallback={<Loading label="Loading workspace" />}>
                {view === 'discover' && <Discover aiEnabled={aiEnabled} />}
                {view === 'map' && <CampusMap theme={theme} />}
                {view === 'requests' && <StudentRequests today={todayLocal()} />}
                {view === 'bookings' && <MyBookings />}
                {view === 'approvals' && <Approvals />}
                {view === 'resolve' && <Resolver />}
                {view === 'utilisation' && <Dashboard />}
              </Suspense>
            ) : (
              <Loading label="Starting LabLink" />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-slate-500 sm:px-6 lg:px-8 dark:text-slate-400">
          <span>LabLink · Shared Campus Laboratories</span>
          <span>Fair scheduling across CSE, ECE, Mechanical, Biotech, and Design</span>
        </div>
      </footer>
    </div>
  );
}
