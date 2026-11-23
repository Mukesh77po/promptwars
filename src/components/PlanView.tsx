import type { Plan } from '../api.ts';
import { formatDate, formatRange } from '../format.ts';
import { SourceLabel, StatusText } from './ui.tsx';

export function PlanView({
  plan,
  title = 'Proposed allocation',
}: {
  plan: Plan;
  title?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <SourceLabel source={plan.source} />
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300">{plan.summary}</p>

      <ol className="space-y-3" aria-label="Allocation ranked by priority">
        {plan.results.map((r, i) => (
          <li
            key={r.requestId}
            className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <span className="mr-1.5 font-mono text-xs text-slate-500 tabular-nums">
                    #{i + 1}
                  </span>
                  {r.studentName} — {r.projectTitle}
                </h4>
                <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  Priority {r.priority.toFixed(2)} · {r.hoursGranted}/{r.hoursNeeded} h granted · due{' '}
                  {formatDate(r.deadline)}
                </p>
              </div>
              <StatusText status={r.outcome} />
            </div>

            {r.ranges.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-slate-200 pt-2.5 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300">
                {r.ranges.map((g) => (
                  <li
                    key={`${g.equipmentId}-${g.date}-${g.startHour}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="font-mono font-medium tabular-nums">
                      {formatRange(g.date, g.startHour, g.endHour)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {g.equipmentName} ({g.labName})
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {r.explanation && (
              <p className="mt-2.5 text-xs leading-relaxed text-teal-800 dark:text-teal-300">
                {r.explanation}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
