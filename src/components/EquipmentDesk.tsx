import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import type { DeskView } from '../api.ts';
import { errorMessage, formatRange } from '../format.ts';
import { Loading, Notice, StatusText } from './ui.tsx';

export function EquipmentDesk() {
  const [desk, setDesk] = useState<DeskView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const load = () =>
    api
      .desk()
      .then(setDesk)
      .catch((err) => setMessage({ tone: 'bad', text: errorMessage(err) }));

  useEffect(() => {
    void load();
  }, []);

  async function action(id: string, kind: 'checkout' | 'return') {
    setBusyId(id);
    setMessage(null);
    try {
      const res = kind === 'checkout' ? await api.checkOut(id) : await api.returnItem(id);
      const fineMsg =
        res.booking.fine && !res.booking.fine.paid
          ? ` Late return fine of ₹${res.booking.fine.amount} recorded.`
          : '';
      setMessage({
        tone: 'ok',
        text:
          kind === 'checkout'
            ? `${res.booking.equipment?.name ?? 'Unit'} handed out to ${res.booking.studentName}.`
            : `${res.booking.equipment?.name ?? 'Unit'} marked returned.${fineMsg}`,
      });
      await load();
    } catch (err) {
      setMessage({ tone: 'bad', text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  if (!desk) return <Loading label="Loading equipment desk" />;

  return (
    <div className="space-y-8">
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Checked out now</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {desk.out.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Overdue units</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-rose-700 tabular-nums dark:text-rose-400">
            {desk.overdueCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Due to collect today
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {desk.toCollect.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Unpaid fines</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-amber-700 tabular-nums dark:text-amber-400">
            ₹{desk.unpaidFines}
          </p>
        </div>
      </div>

      <section aria-labelledby="out-heading">
        <h2
          id="out-heading"
          className="mb-3 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
        >
          Currently checked out ({desk.out.length})
        </h2>
        {desk.out.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No units checked out.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Booked slot</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {desk.out.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {b.equipment?.name ?? b.equipmentId}
                      <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                        {b.equipment?.labName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                      {b.studentName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-400">
                      {formatRange(b.date, b.startHour, b.endHour)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusText status={b.overdue ? 'overdue' : 'checked_out'} />
                      {b.overdue && b.accruingFine && (
                        <span className="block font-mono text-xs text-rose-700 tabular-nums dark:text-rose-400">
                          ₹{b.accruingFine} accruing
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => void action(b.id, 'return')}
                        className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
                      >
                        {busyId === b.id ? 'Recording…' : 'Mark returned'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="collect-heading">
        <h2
          id="collect-heading"
          className="mb-3 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
        >
          Scheduled today — ready for hand-out ({desk.toCollect.length})
        </h2>
        {desk.toCollect.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No scheduled hand-outs remaining for today.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Slot</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {desk.toCollect.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {b.equipment?.name ?? b.equipmentId}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                      {b.studentName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-400">
                      {formatRange(b.date, b.startHour, b.endHour)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => void action(b.id, 'checkout')}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-teal-600 hover:text-teal-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        {busyId === b.id ? 'Checking out…' : 'Check out'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="returned-heading">
        <h2
          id="returned-heading"
          className="mb-3 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
        >
          Recent returns ({desk.returned.length})
        </h2>
        {desk.returned.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No returns logged yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Booked slot</th>
                  <th className="px-4 py-3 text-right">Fine status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {desk.returned.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {b.equipment?.name ?? b.equipmentId}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                      {b.studentName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-400">
                      {formatRange(b.date, b.startHour, b.endHour)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {b.fine ? (
                        <span
                          className={
                            b.fine.paid
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'font-semibold text-amber-700 dark:text-amber-400'
                          }
                        >
                          ₹{b.fine.amount} ({b.fine.paid ? 'paid' : 'unpaid'})
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400">On time</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
