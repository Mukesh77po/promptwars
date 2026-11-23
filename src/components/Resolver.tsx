import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import type { ConflictGroup, Plan } from '../api.ts';
import { errorMessage } from '../format.ts';
import { PlanView } from './PlanView.tsx';
import { Loading, Notice, PageHeader } from './ui.tsx';

export function Resolver() {
  const [conflicts, setConflicts] = useState<ConflictGroup[] | null>(null);
  const [active, setActive] = useState<ConflictGroup | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [applied, setApplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = () =>
    api
      .conflicts()
      .then((r) => setConflicts(r.conflicts))
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    void refresh();
  }, []);

  async function preview(group: ConflictGroup) {
    setActive(group);
    setPlan(null);
    setApplied(false);
    setBusy(true);
    setError('');
    try {
      setPlan((await api.resolve(group.requestIds)).plan);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!active) return;
    setBusy(true);
    setError('');
    try {
      setPlan((await api.apply(active.requestIds)).plan);
      setApplied(true);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Resolve scheduling conflicts"
        intro="When multiple student projects compete for the same equipment category, LabLink computes a deterministic plan: 50% deadline urgency, 30% fairness history, 20% slot feasibility. Overflow routes to identical units in other labs."
      />

      {error && (
        <div className="mb-6">
          <Notice tone="bad">{error}</Notice>
        </div>
      )}

      {!conflicts ? (
        <Loading label="Scanning pending requests for conflicts" />
      ) : conflicts.length === 0 ? (
        <Notice tone="ok">
          No competing equipment requests right now. All pending items can be reviewed individually.
        </Notice>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {conflicts.map((c) => {
            const shortfall = c.hoursDemanded > c.freeHours;
            const selected = active?.equivalentGroup === c.equivalentGroup;
            return (
              <li
                key={c.equivalentGroup}
                className={`flex flex-col justify-between rounded-xl border bg-white p-5 dark:bg-slate-900 ${
                  selected
                    ? 'border-teal-600 ring-1 ring-teal-600 dark:border-teal-500'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {c.category}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-400">
                    {c.requestIds.length} competing requests · {c.hoursDemanded} h demanded ·{' '}
                    {c.freeHours} h free across labs
                  </p>
                  <p
                    className={`mt-3 text-xs font-semibold ${
                      shortfall
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {shortfall
                      ? '▲ Demand exceeds free capacity'
                      : '● Capacity exists when balanced across labs'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void preview(c)}
                  className="mt-4 w-full rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
                >
                  Generate fair plan
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <section aria-live="polite" className="mt-8">
        {busy && !plan && <Loading label="Computing fair allocation" />}
        {plan && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <PlanView
              plan={plan}
              title={
                applied ? 'Allocation applied' : `Proposed fair plan · ${active?.category ?? ''}`
              }
            />
            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
              {applied ? (
                <Notice tone="ok">
                  Bookings created. Students can view their allocated slots under My bookings.
                </Notice>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void apply()}
                  className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
                >
                  Apply plan &amp; create bookings
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
