import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import type { TrackedBooking } from '../api.ts';
import { errorMessage, formatRange } from '../format.ts';
import { Loading, Notice, PageHeader, StatusText } from './ui.tsx';

export function MyBookings() {
  const [bookings, setBookings] = useState<TrackedBooking[] | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const load = () =>
    api
      .myBookings()
      .then((r) => setBookings(r.bookings))
      .catch((err) => setMessage({ tone: 'bad', text: errorMessage(err) }));

  useEffect(() => {
    void load();
  }, []);

  async function payFine(id: string) {
    setPaying(id);
    setMessage(null);
    try {
      await api.payFine(id);
      setMessage({ tone: 'ok', text: 'Late-return fine marked as paid.' });
      await load();
    } catch (err) {
      setMessage({ tone: 'bad', text: errorMessage(err) });
    } finally {
      setPaying(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="My bookings"
        intro="Upcoming slots, direct reservations, approved project allocations, and equipment return status."
      />

      {message && (
        <div className="mb-6">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}

      {!bookings ? (
        <Loading label="Loading your bookings" />
      ) : bookings.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No upcoming bookings yet. Visit Discover to reserve an available unit.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th scope="col" className="px-4 py-3">
                    When
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Equipment
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Lab &amp; Location
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Source
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Fines
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bookings.map((b) => {
                  const status = b.overdue ? 'overdue' : (b.status ?? 'scheduled');
                  return (
                    <tr
                      key={b.id}
                      className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-slate-800 tabular-nums dark:text-slate-200">
                        {formatRange(b.date, b.startHour, b.endHour)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {b.equipment?.name ?? b.equipmentId}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {b.equipment?.labName}
                        </span>
                        {b.equipment?.location ? ` · ${b.equipment.location}` : ''}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {b.requestId ? 'Project allocation' : 'Direct booking'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusText status={status} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                        {b.overdue && b.accruingFine ? (
                          <span className="font-semibold text-rose-700 dark:text-rose-400">
                            ₹{b.accruingFine} accruing
                          </span>
                        ) : b.fine ? (
                          b.fine.paid ? (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              ₹{b.fine.amount} paid
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={paying === b.id}
                              onClick={() => void payFine(b.id)}
                              className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 font-sans text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            >
                              {paying === b.id ? 'Paying…' : `Pay ₹${b.fine.amount}`}
                            </button>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
