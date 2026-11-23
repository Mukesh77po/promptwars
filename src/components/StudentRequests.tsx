import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { EquipmentView } from '../shared/types.ts';
import { api } from '../api.ts';
import type { RequestView } from '../api.ts';
import { errorMessage, formatDate } from '../format.ts';
import { Loading, Notice, PageHeader, SourceLabel, StatusText } from './ui.tsx';

export function StudentRequests({ today }: { today: string }) {
  const [requests, setRequests] = useState<RequestView[] | null>(null);
  const [catalog, setCatalog] = useState<EquipmentView[]>([]);

  const [idea, setIdea] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ rationale: string; source: string } | null>(null);

  const [form, setForm] = useState({
    projectTitle: '',
    equipmentId: '',
    description: '',
    deadline: today,
    hoursNeeded: 6,
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const load = () =>
    Promise.all([api.requests(), api.catalog({ available: true })])
      .then(([reqs, cat]) => {
        setRequests(reqs.requests);
        setCatalog(cat.items);
      })
      .catch((err) => setMessage({ tone: 'bad', text: errorMessage(err) }));

  useEffect(() => {
    void load();
  }, []);

  async function draftFromIdea(e: React.FormEvent) {
    e.preventDefault();
    if (idea.trim().length < 5) return;
    setDrafting(true);
    setMessage(null);
    try {
      const { draft } = await api.draft(idea.trim());
      setForm((f) => ({
        ...f,
        projectTitle: draft.projectTitle,
        description: draft.description,
        equipmentId: draft.equipmentId,
        hoursNeeded: draft.hoursNeeded,
      }));
      setDraftInfo({ rationale: draft.rationale, source: draft.source });
    } catch (err) {
      setMessage({ tone: 'bad', text: errorMessage(err) });
    } finally {
      setDrafting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await api.createRequest({
        projectTitle: form.projectTitle,
        equipmentId: form.equipmentId,
        description: form.description,
        deadline: form.deadline,
        hoursNeeded: Number(form.hoursNeeded),
      });
      setMessage({
        tone: 'ok',
        text: 'Project request submitted for faculty approval.',
      });
      setForm({
        projectTitle: '',
        equipmentId: '',
        description: '',
        deadline: today,
        hoursNeeded: 6,
      });
      setIdea('');
      setDraftInfo(null);
      await load();
    } catch (err) {
      setMessage({ tone: 'bad', text: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Project requests"
        intro="Need more than a 4-hour direct slot or competing before a tight deadline? Submit a project request so faculty can allocate lab time fairly."
      />

      {message && (
        <div className="mb-6">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Sparkles className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
              <span>AI Request Drafter</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Describe your project in plain words to auto-select equipment and estimate hours.
            </p>
            <form onSubmit={draftFromIdea} className="mt-3 space-y-3">
              <textarea
                rows={2}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="e.g. Build and test an autonomous rover obstacle sensor enclosure by Friday"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={drafting || idea.trim().length < 5}
                className="rounded-lg border border-teal-700 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-100 disabled:opacity-50 dark:border-teal-600 dark:bg-teal-950/50 dark:text-teal-300"
              >
                {drafting ? 'Drafting…' : 'Draft request from idea'}
              </button>
            </form>
            {draftInfo && (
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                <span>{draftInfo.rationale}</span>
                <SourceLabel source={draftInfo.source} />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Submit project request
            </h2>
            <form onSubmit={submit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Project title
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={120}
                  value={form.projectTitle}
                  onChange={(e) => setForm((f) => ({ ...f, projectTitle: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Equipment
                </label>
                <select
                  required
                  value={form.equipmentId}
                  onChange={(e) => setForm((f) => ({ ...f, equipmentId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Choose equipment…</option>
                  {catalog.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} — {e.labName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  What will you build or measure?
                </label>
                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Deadline
                  </label>
                  <input
                    type="date"
                    required
                    min={today}
                    value={form.deadline}
                    onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Hours needed (1–40)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={40}
                    value={form.hoursNeeded}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, hoursNeeded: Number(e.target.value) }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
              >
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
            </form>
          </section>
        </div>

        <section aria-labelledby="my-requests-heading" className="lg:col-span-7">
          <h2
            id="my-requests-heading"
            className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Your submitted requests
          </h2>

          {!requests ? (
            <Loading label="Loading requests" />
          ) : requests.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              No project requests yet. Use the form on the left to submit one.
            </div>
          ) : (
            <ul className="space-y-4" role="list">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {r.projectTitle}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                        {r.equipmentName} ({r.labName}) · {r.hoursNeeded} h requested · due{' '}
                        {formatDate(r.deadline)}
                      </p>
                    </div>
                    <StatusText status={r.status} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{r.description}</p>
                  {r.risks.length > 0 && r.status === 'pending' && (
                    <p className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-amber-700 dark:border-slate-800 dark:text-amber-400">
                      Capacity note: {r.risks.join(' · ')}
                    </p>
                  )}
                  {r.facultyNote && (
                    <p className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300">
                      Faculty note: {r.facultyNote}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
