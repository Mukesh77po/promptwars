import { useEffect, useState } from 'react';
import type { UtilisationReport } from '../shared/types.ts';
import { api } from '../api.ts';
import { errorMessage, percent } from '../format.ts';
import { Loading, Notice, PageHeader } from './ui.tsx';

function Bar({ value, label }: { value: number; label: string }) {
  const w = Math.min(100, Math.round(value * 100));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      role="img"
      aria-label={`${label}: ${percent(value)} utilised`}
    >
      <div
        className="h-full rounded-full bg-teal-600 transition-all dark:bg-teal-500"
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

export function Dashboard() {
  const [report, setReport] = useState<UtilisationReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .utilisation()
      .then(setReport)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!report) return <Loading label="Computing campus utilisation" />;

  const idle = report.items.filter((i) => i.utilisation === 0).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Campus utilisation"
        intro={`Booked share of open laboratory hours (09:00–17:00) across the next ${report.windowDays} days, with rebalancing cues across equivalent units.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Overall campus utilisation
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {percent(report.overall)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Active bookable units
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {report.items.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Idle units this week
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {idle}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <section
          aria-labelledby="redirect-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 id="redirect-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Rebalancing suggestions
          </h2>
          {report.redirects.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              Load is evenly distributed across equivalent equipment groups.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {report.redirects.map((r) => (
                <li key={`${r.from}-${r.to}`} className="py-3 first:pt-0 last:pb-0">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {r.fromName}
                  </span>{' '}
                  <span className="text-slate-600 dark:text-slate-400">
                    is running near peak — point students to the under-used{' '}
                  </span>
                  <span className="font-semibold text-teal-800 dark:text-teal-300">{r.toName}</span>
                  <span className="text-slate-600 dark:text-slate-400"> in {r.toLab}.</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="dept-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 id="dept-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Utilisation by department
          </h2>
          <ul className="mt-4 space-y-4">
            {report.byDepartment.map((d) => (
              <li key={d.departmentId} className="grid grid-cols-12 items-center gap-3">
                <span className="col-span-5 truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                  {d.name}
                </span>
                <div className="col-span-5">
                  <Bar value={d.utilisation} label={d.name} />
                </div>
                <span className="col-span-2 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                  {percent(d.utilisation)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section
        aria-labelledby="items-heading"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 id="items-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Equipment breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                <th scope="col" className="px-5 py-3">
                  Equipment
                </th>
                <th scope="col" className="px-5 py-3">
                  Laboratory
                </th>
                <th scope="col" className="px-5 py-3 text-right">
                  Booked hours
                </th>
                <th scope="col" className="w-56 px-5 py-3">
                  Utilisation
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {report.items.map((i) => (
                <tr
                  key={i.equipmentId}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {i.name}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400">
                    {i.labName}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs text-slate-700 tabular-nums dark:text-slate-300">
                    {i.bookedHours} / {i.openHours} h
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Bar value={i.utilisation} label={i.name} />
                      <span className="w-10 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                        {percent(i.utilisation)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
