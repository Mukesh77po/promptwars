import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Clock, Info, Sparkles, Wrench } from 'lucide-react';

export function PageHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  intro: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
      <div className="max-w-2xl">
        <h1
          id="page-title"
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight text-slate-900 outline-none sm:text-3xl dark:text-slate-100"
          style={{ textWrap: 'balance' }}
        >
          {title}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{intro}</p>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'ok' | 'warn' | 'bad';
  children: ReactNode;
}) {
  const styles = {
    info: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
    ok: 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200',
    warn: 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
    bad: 'border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200',
  }[tone];

  const Icon = {
    info: Info,
    ok: CheckCircle2,
    warn: Clock,
    bad: AlertCircle,
  }[tone];

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${styles}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function StatusText({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon?: typeof CheckCircle2 }> = {
    available: { label: 'Available', cls: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
    maintenance: { label: 'Maintenance', cls: 'text-amber-700 dark:text-amber-400', icon: Wrench },
    pending: { label: 'Pending review', cls: 'text-amber-700 dark:text-amber-400', icon: Clock },
    approved: { label: 'Approved', cls: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
    allocated: { label: 'Allocated', cls: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
    partial: { label: 'Partial', cls: 'text-amber-700 dark:text-amber-400', icon: Clock },
    waitlisted: { label: 'Waitlisted', cls: 'text-rose-700 dark:text-rose-400', icon: AlertCircle },
    rejected: { label: 'Rejected', cls: 'text-rose-700 dark:text-rose-400', icon: AlertCircle },
    scheduled: { label: 'Scheduled', cls: 'text-slate-700 dark:text-slate-300', icon: Clock },
    checked_out: { label: 'Checked out', cls: 'text-teal-700 dark:text-teal-400', icon: Info },
    returned: { label: 'Returned', cls: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
    overdue: { label: 'Overdue', cls: 'text-rose-700 dark:text-rose-400', icon: AlertCircle },
  };
  const entry = map[status] ?? {
    label: status.replaceAll('_', ' '),
    cls: 'text-slate-600 dark:text-slate-400',
  };
  const Icon = entry.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${entry.cls}`}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{entry.label}</span>
    </span>
  );
}

export function SourceLabel({ source }: { source: string }) {
  const isAi = source === 'ai';
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400">
      {isAi && <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{isAi ? 'Gemini AI' : source === 'keyword' ? 'Keyword match' : 'Rule engine'}</span>
    </span>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-slate-500 dark:text-slate-400">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600 dark:border-slate-700 dark:border-t-teal-400" />
      <span>{label}…</span>
    </div>
  );
}
