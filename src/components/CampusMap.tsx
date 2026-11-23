import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { Department, EquipmentView } from '../shared/types.ts';
import { api } from '../api.ts';
import { errorMessage } from '../format.ts';
import { BookingPanel } from './BookingPanel.tsx';
import { Loading, Notice, PageHeader, StatusText } from './ui.tsx';

const CampusScene = lazy(() =>
  import('./CampusScene.tsx').then((m) => ({ default: m.CampusScene })),
);

export function CampusMap({ theme }: { theme: 'light' | 'dark' }) {
  const [items, setItems] = useState<EquipmentView[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selected, setSelected] = useState<string | null>('cse');
  const [booking, setBooking] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .catalog()
      .then((r) => {
        setItems(r.items);
        setDepartments(r.departments);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const labs = useMemo(() => {
    const inDept = (items ?? []).filter((e) => e.departmentId === selected);
    const byLab = new Map<string, { name: string; location: string; equipment: EquipmentView[] }>();
    for (const e of inDept) {
      const lab = byLab.get(e.labId) ?? { name: e.labName, location: e.location, equipment: [] };
      lab.equipment.push(e);
      byLab.set(e.labId, lab);
    }
    return [...byLab.values()];
  }, [items, selected]);

  const counts = useMemo(() => {
    const map = new Map<string, { total: number; available: number }>();
    for (const e of items ?? []) {
      const c = map.get(e.departmentId) ?? { total: 0, available: 0 };
      c.total += 1;
      if (e.status === 'available') c.available += 1;
      map.set(e.departmentId, c);
    }
    return map;
  }, [items]);

  const dept = departments.find((d) => d.id === selected);

  return (
    <div>
      <PageHeader
        title="Campus map"
        intro="Explore departments in 3D. Drag to rotate, scroll to zoom, and click any building or choose from the directory."
      />

      {error && (
        <div className="mb-6">
          <Notice tone="bad">{error}</Notice>
        </div>
      )}

      {!items ? (
        <Loading label="Loading campus topology" />
      ) : (
        <div className="space-y-8">
          <div className="grid items-stretch gap-6 lg:grid-cols-12">
            <figure className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
              <div className="min-h-[380px] flex-1 lg:min-h-[440px]">
                <Suspense
                  fallback={
                    <div
                      className="h-full w-full bg-slate-100 dark:bg-slate-900"
                      aria-hidden="true"
                    />
                  }
                >
                  <CampusScene
                    interactive
                    selected={selected}
                    onSelect={(id) => {
                      setSelected(id);
                      setBooking(null);
                    }}
                    theme={theme}
                  />
                </Suspense>
              </div>
              <figcaption className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                {dept ? `Selected building: ${dept.name}` : 'Click a building to inspect its labs.'}
              </figcaption>
            </figure>

            <nav aria-label="Departments" className="flex flex-col justify-between lg:col-span-5">
              <div className="space-y-2.5">
                <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Departments
                </h2>
                <ul className="space-y-2" role="list">
                  {departments.map((d) => {
                    const c = counts.get(d.id);
                    const active = selected === d.id;
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(d.id);
                            setBooking(null);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                            active
                              ? 'border-teal-600 bg-teal-50/50 text-teal-950 dark:border-teal-500 dark:bg-teal-950/30 dark:text-teal-100'
                              : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
                          }`}
                        >
                          <span className="text-sm font-semibold">{d.name}</span>
                          <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                            {c?.available ?? 0}/{c?.total ?? 0} ready
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {dept && (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{dept.name}</p>
                  <p className="mt-1">
                    {labs.length} laborator{labs.length === 1 ? 'y' : 'ies'} listed below. Select
                    any available unit to open its 7-day booking timetable.
                  </p>
                </div>
              )}
            </nav>
          </div>

          {booking && <BookingPanel equipmentId={booking} onClose={() => setBooking(null)} />}

          {dept && (
            <section aria-labelledby="dept-labs-heading" className="space-y-4">
              <h2
                id="dept-labs-heading"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {dept.name} — Laboratories
              </h2>
              <div className="grid gap-5 lg:grid-cols-2">
                {labs.map((lab) => (
                  <div
                    key={lab.name}
                    className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {lab.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{lab.location}</p>
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800" role="list">
                      {lab.equipment.map((e) => (
                        <li
                          key={e.id}
                          className="flex items-center justify-between gap-4 py-3 first:pt-3 last:pb-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                              {e.name}
                            </p>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span>{e.category}</span>
                              <span aria-hidden="true">·</span>
                              <StatusText status={e.status} />
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={e.status !== 'available'}
                            onClick={() => setBooking(e.id)}
                            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-teal-600 hover:text-teal-800 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                          >
                            View slots
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
