import { useEffect, useState } from 'react';
import { Calendar, Search, Sparkles } from 'lucide-react';
import type { Department, EquipmentView, SearchMatch } from '../shared/types.ts';
import { api } from '../api.ts';
import { errorMessage } from '../format.ts';
import { BookingPanel } from './BookingPanel.tsx';
import { Loading, Notice, PageHeader, SourceLabel, StatusText } from './ui.tsx';

const EXAMPLES = [
  'Debug I2C communication on a microcontroller',
  'Train a deep learning vision model',
  'Print a prototype drone enclosure',
  'Measure fluorescence in cell samples',
];

export function Discover({ aiEnabled }: { aiEnabled: boolean }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ source: string; matches: SearchMatch[] } | null>(null);

  const [items, setItems] = useState<EquipmentView[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .catalog({
        department: department || undefined,
        category: category || undefined,
        available: availableOnly,
      })
      .then((r) => {
        setItems(r.items);
        setDepartments(r.departments);
        setCategories(r.categories);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [department, category, availableOnly]);

  async function runSearch(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 2) return;
    setSearching(true);
    setError('');
    try {
      const res = await api.search(trimmed);
      setResults(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Discover lab equipment"
        intro="Describe what you need to build or measure, or filter across all five campus departments to inspect live hourly availability."
      />

      <section
        aria-labelledby="search-heading"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2
            id="search-heading"
            className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            <Sparkles className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            <span>{aiEnabled ? 'AI Equipment Finder' : 'Smart Equipment Finder'}</span>
          </h2>
          {results && (
            <button
              type="button"
              onClick={() => {
                setResults(null);
                setQuery('');
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Clear search
            </button>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(query);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Measure high-frequency PWM noise or print an enclosure…"
              aria-label="Describe the task or equipment needed"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            disabled={searching || query.trim().length < 2}
            className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            {searching ? 'Searching…' : 'Find equipment'}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Example searches">
          <span className="text-xs text-slate-500 dark:text-slate-400">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
                void runSearch(ex);
              }}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-teal-600 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:border-teal-500 dark:hover:text-teal-300"
            >
              {ex}
            </button>
          ))}
        </div>

        <div aria-live="polite">
          {searching && <Loading label="Matching catalog units" />}
          {results && !searching && (
            <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="mb-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {results.matches.length} recommended unit{results.matches.length === 1 ? '' : 's'}
                </span>
                <SourceLabel source={results.source} />
              </div>
              {results.matches.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No direct matches found. Try broader keywords or browse the full catalog below.
                </p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
                  {results.matches.map((m) => (
                    <EquipmentCard
                      key={m.equipment.id}
                      item={m.equipment}
                      reason={m.reason}
                      active={selected === m.equipment.id}
                      onSelect={setSelected}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      {selected && (
        <div className="mb-8">
          <BookingPanel equipmentId={selected} onClose={() => setSelected(null)} />
        </div>
      )}

      <section aria-labelledby="browse-heading">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="browse-heading"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              All campus laboratories
            </h2>
            <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
              Showing {items.length} unit{items.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Filter by department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="h-3.5 w-3.5 accent-teal-700"
              />
              <span>Available only</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <Notice tone="bad">{error}</Notice>
          </div>
        )}

        {loading ? (
          <Loading label="Loading equipment catalog" />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {items.map((item) => (
              <EquipmentCard
                key={item.id}
                item={item}
                active={selected === item.id}
                onSelect={setSelected}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EquipmentCard({
  item,
  reason,
  active,
  onSelect,
}: {
  item: EquipmentView;
  reason?: string;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li
      className={`flex flex-col justify-between rounded-xl border bg-white p-5 transition-colors dark:bg-slate-900 ${
        active
          ? 'border-teal-600 ring-1 ring-teal-600 dark:border-teal-500 dark:ring-teal-500'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
          <StatusText status={item.status} />
        </div>

        <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
          {item.name}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {item.category} · {item.labName}
        </p>

        <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500 dark:text-slate-400">Department</dt>
            <dd className="text-right font-medium text-slate-800 dark:text-slate-200">
              {item.departmentName}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500 dark:text-slate-400">Location</dt>
            <dd className="text-right font-medium text-slate-800 dark:text-slate-200">
              {item.location}
            </dd>
          </div>
          <div className="pt-1">
            <dt className="sr-only">Specifications</dt>
            <dd className="text-slate-600 dark:text-slate-300">{item.specs}</dd>
          </div>
        </dl>

        {reason && (
          <p className="mt-3 border-t border-teal-100 pt-2.5 text-xs text-teal-800 dark:border-teal-900/50 dark:text-teal-300">
            {reason}
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={item.status !== 'available'}
        onClick={() => onSelect(item.id)}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:bg-teal-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-teal-600 dark:hover:bg-teal-600"
      >
        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{item.status === 'available' ? 'View availability & book' : 'Under maintenance'}</span>
      </button>
    </li>
  );
}
