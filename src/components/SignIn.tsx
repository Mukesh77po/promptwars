import { Suspense, lazy, useEffect, useState } from 'react';
import { ArrowRight, CalendarCheck2, Cpu, Scale } from 'lucide-react';
import { api } from '../api.ts';
import type { DemoUser } from '../api.ts';
import { Loading, Notice } from './ui.tsx';
import { errorMessage } from '../format.ts';

const CampusScene = lazy(() =>
  import('./CampusScene.tsx').then((m) => ({ default: m.CampusScene })),
);

export function SignIn({
  onSignedIn,
  theme,
}: {
  onSignedIn: () => void;
  theme: 'light' | 'dark';
}) {
  const [users, setUsers] = useState<DemoUser[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    api
      .demoUsers()
      .then((r) => setUsers(r.users))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function choose(id: string) {
    setBusy(id);
    setError('');
    try {
      await api.signIn(id);
      onSignedIn();
    } catch (err) {
      setError(errorMessage(err));
      setBusy('');
    }
  }

  const students = users?.filter((u) => u.role === 'student') ?? [];
  const faculty = users?.filter((u) => u.role === 'faculty') ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="grid items-stretch gap-8 lg:grid-cols-12">
        <div className="flex flex-col justify-between lg:col-span-6">
          <div>
            <p className="text-xs font-medium tracking-wider text-teal-700 uppercase dark:text-teal-400">
              Campus Laboratory Resource Network
            </p>
            <h1
              className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-100"
              style={{ textWrap: 'balance' }}
            >
              Every lab on campus, one fair booking sheet.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
              Discover oscilloscopes, FPGA boards, 3D printers, and GPU workstations across five
              engineering departments. Reserve clash-free slots or let LabLink balance competing
              project deadlines fairly.
            </p>
          </div>

          <div className="mt-8 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-3 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Cpu className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                <span>30 Lab Units</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Shared across CSE, ECE, Mechanical, Biotech, and Design.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <CalendarCheck2
                  className="h-4 w-4 text-teal-700 dark:text-teal-400"
                  aria-hidden="true"
                />
                <span>Zero Clashes</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Automatic slot redirects to identical units in nearby labs.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Scale className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                <span>Fair Resolution</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                50% urgency, 30% fairness history, 20% slot feasibility.
              </p>
            </div>
          </div>
        </div>

        <figure className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="min-h-[320px] flex-1 lg:min-h-[380px]">
            <Suspense
              fallback={
                <div className="h-full w-full bg-slate-100 dark:bg-slate-900" aria-hidden="true" />
              }
            >
              <CampusScene theme={theme} />
            </Suspense>
          </div>
          <figcaption className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>Live 3D campus topology · 5 departments · 7 labs</span>
            <span className="font-mono tabular-nums">09:00–17:00 IST</span>
          </figcaption>
        </figure>
      </div>

      <section
        id="accounts"
        aria-labelledby="accounts-heading"
        className="mt-12 border-t border-slate-200 pt-10 dark:border-slate-800"
      >
        <div className="mb-6">
          <h2
            id="accounts-heading"
            className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
          >
            Choose a campus profile to begin
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Select a student account to discover, book, and request lab time, or a faculty account
            to review approvals, resolve conflicts, and manage the equipment desk.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <Notice tone="bad">{error}</Notice>
          </div>
        )}

        {!users ? (
          <Loading label="Loading campus profiles" />
        ) : (
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Students ({students.length})
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2" role="list">
                {students.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void choose(u.id)}
                      className="group flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-teal-600 hover:bg-teal-50/30 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-500 dark:hover:bg-teal-950/30"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {u.name}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {u.department}
                        </div>
                      </div>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-700 dark:group-hover:text-teal-400"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-5">
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Faculty &amp; Lab Coordinators ({faculty.length})
              </h3>
              <ul className="grid gap-3" role="list">
                {faculty.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void choose(u.id)}
                      className="group flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-teal-600 hover:bg-teal-50/30 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-500 dark:hover:bg-teal-950/30"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {u.name}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          Faculty · {u.department}
                        </div>
                      </div>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-700 dark:group-hover:text-teal-400"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
