import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../api.ts';
import type { Plan, RequestView } from '../api.ts';
import { errorMessage, formatDate } from '../format.ts';
import { EquipmentDesk } from './EquipmentDesk.tsx';
import { PlanView } from './PlanView.tsx';
import { Loading, Notice, PageHeader, SourceLabel, StatusText } from './ui.tsx';

export function Approvals() {
  const [tab, setTab] = useState<'queue' | 'desk'>('queue');
  const [requests, setRequests] = useState<RequestView[] | null>(null);
  const [error, setError] = useState('');

  const refresh = () =>
    api
      .requests()
      .then((r) => setRequests(r.requests))
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    void refresh();
  }, []);

  const pending = requests?.filter((r) => r.status === 'pending') ?? [];
  const decided = requests?.filter((r) => r.status !== 'pending') ?? [];

  return (
    <div>
      <PageHeader
        title="Approvals & equipment desk"
        intro="Review pending project requests ordered by deadline urgency, or manage live physical check-outs, returns, and late fines."
        actions={
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setTab('queue')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === 'queue'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Approval queue ({pending.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('desk')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === 'desk'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Equipment desk
            </button>
          </div>
        }
      />

      {tab === 'desk' ? (
        <EquipmentDesk />
      ) : (
        <div className="space-y-10">
          {error && <Notice tone="bad">{error}</Notice>}

          {!requests ? (
            <Loading label="Loading approval queue" />
          ) : (
            <>
              <section aria-labelledby="pending-heading">
                <h2
                  id="pending-heading"
                  className="mb-4 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
                >
                  Pending review ({pending.length})
                </h2>

                {pending.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                    All pending project requests have been reviewed.
                  </div>
                ) : (
                  <ul className="space-y-4" role="list">
                    {pending.map((r) => (
                      <ApprovalCard key={r.id} request={r} onDecided={() => void refresh()} />
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="decided-heading">
                <h2
                  id="decided-heading"
                  className="mb-4 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
                >
                  Recently decided ({decided.length})
                </h2>
                {decided.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No decisions recorded in this session yet.
                  </p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2" role="list">
                    {decided.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {r.projectTitle}
                            </h3>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {r.studentName} · {r.equipmentName}
                            </p>
                          </div>
                          <StatusText status={r.status} />
                        </div>
                        {r.facultyNote && (
                          <p className="mt-2.5 border-t border-slate-100 pt-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                            Note: {r.facultyNote}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({
  request,
  onDecided,
}: {
  request: RequestView;
  onDecided: () => void;
}) {
  const [summary, setSummary] = useState<{ text: string; source: string } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');

  async function loadSummary() {
    setLoadingSummary(true);
    setError('');
    try {
      const res = await api.summary(request.id);
      setSummary({ text: res.summary, source: res.source });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingSummary(false);
    }
  }

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true);
    setError('');
    try {
      const res = await api.decide(
        request.id,
        decision,
        decision === 'reject' && note.trim() ? note.trim() : undefined,
      );
      if (res.plan) setPlan(res.plan);
      else onDecided();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {request.projectTitle}
            <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
              · {request.studentName}
            </span>
          </h3>
          <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {request.equipmentName} ({request.labName}) · {request.hoursNeeded} h needed · due{' '}
            {formatDate(request.deadline)} · {request.freeHoursBeforeDeadline} h free before deadline
          </p>
        </div>
        <StatusText status={plan ? 'approved' : request.status} />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {request.description}
      </p>

      {request.risks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-amber-700 dark:text-amber-400">
          {request.risks.map((risk) => (
            <span key={risk}>▲ {risk}</span>
          ))}
        </div>
      )}

      {summary && (
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/50 p-3.5 text-xs dark:border-teal-900/60 dark:bg-teal-950/30">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold text-teal-900 dark:text-teal-200">
              Feasibility assessment
            </span>
            <SourceLabel source={summary.source} />
          </div>
          <p className="leading-relaxed text-teal-900/90 dark:text-teal-200/90">{summary.text}</p>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Notice tone="bad">{error}</Notice>
        </div>
      )}

      {plan ? (
        <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
          <PlanView plan={plan} title="Scheduled slots" />
          <button
            type="button"
            onClick={onDecided}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Done · move to decided
          </button>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide('approve')}
            className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            {busy ? 'Scheduling…' : 'Approve & auto-schedule'}
          </button>

          <button
            type="button"
            disabled={loadingSummary}
            onClick={() => void loadSummary()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-600 hover:text-teal-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
          >
            <Sparkles className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            <span>{loadingSummary ? 'Summarizing…' : 'AI feasibility brief'}</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => setRejecting((v) => !v)}
            className="rounded-lg border border-rose-200 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            Reject
          </button>
        </div>
      )}

      {rejecting && !plan && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void decide('reject');
          }}
          className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:flex-row dark:border-slate-800 dark:bg-slate-950"
        >
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for the student (e.g. split batch or move deadline)…"
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
          >
            Confirm rejection
          </button>
        </form>
      )}
    </li>
  );
}
