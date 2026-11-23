import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { MAX_BOOKING_HOURS } from '../shared/constants.ts';
import { ApiError, api } from '../api.ts';
import type { Alternatives, TimeWindow } from '../api.ts';
import { errorMessage, formatDate, formatHour, formatRange } from '../format.ts';
import { Loading, Notice } from './ui.tsx';

type Availability = Awaited<ReturnType<typeof api.availability>>;
type Pick = { date: string; hour: number } | null;

export function BookingPanel({
  equipmentId,
  onClose,
}: {
  equipmentId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Availability | null>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [hours, setHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'bad'; text: string } | null>(
    null,
  );
  const [alternatives, setAlternatives] = useState<Alternatives | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = () =>
    api
      .availability(equipmentId, 7)
      .then((res) => {
        setData(res);
        setPick(null);
      })
      .catch((err) => setMessage({ tone: 'bad', text: errorMessage(err) }));

  useEffect(() => {
    setData(null);
    setMessage(null);
    setAlternatives(null);
    void load();
  }, [equipmentId]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [equipmentId, Boolean(data)]);

  async function book(unitId: string, date: string, startHour: number, duration: number) {
    setBusy(true);
    setMessage(null);
    setAlternatives(null);
    try {
      await api.book({ equipmentId: unitId, date, startHour, hours: duration });
      setMessage({
        tone: 'ok',
        text: `Booked ${formatRange(date, startHour, startHour + duration)}. View anytime under My bookings.`,
      });
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { alternatives?: Alternatives };
        if (body.alternatives) {
          setMessage({
            tone: 'warn',
            text: err.message,
          });
          setAlternatives(body.alternatives);
          return;
        }
      }
      setMessage({ tone: 'bad', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <Loading label="Loading 7-day slot matrix" />
      </section>
    );
  }

  const { equipment, now } = data;

  return (
    <section
      aria-labelledby="booking-title"
      className="rounded-xl border border-teal-600/40 bg-white p-5 sm:p-6 dark:border-teal-500/40 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h2
            id="booking-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-semibold text-slate-900 outline-none dark:text-slate-100"
          >
            {equipment.name}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {equipment.labName} · {equipment.location} · {equipment.specs}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close booking panel"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Close</span>
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th scope="col" className="py-2 pr-3 font-medium text-slate-500 dark:text-slate-400">
                Day
              </th>
              {data.days[0]?.hours.map((h) => (
                <th
                  scope="col"
                  key={h.hour}
                  className="px-1 py-2 text-center font-mono font-medium text-slate-500 tabular-nums dark:text-slate-400"
                >
                  {formatHour(h.hour)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {data.days.map((day) => (
              <tr key={day.date}>
                <th
                  scope="row"
                  className="py-2 pr-3 font-medium whitespace-nowrap text-slate-700 dark:text-slate-300"
                >
                  {formatDate(day.date)}
                </th>
                {day.hours.map((h) => {
                  const past = day.date === now.date && h.hour <= now.hour;
                  const chosen = pick?.date === day.date && pick.hour === h.hour;
                  if (past) {
                    return (
                      <td key={h.hour} className="p-1 text-center">
                        <span className="inline-block w-full rounded bg-slate-100 py-1.5 font-mono text-[11px] text-slate-400 dark:bg-slate-800/60 dark:text-slate-600">
                          —
                        </span>
                      </td>
                    );
                  }
                  if (h.booked) {
                    return (
                      <td key={h.hour} className="p-1 text-center">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void book(equipment.id, day.date, h.hour, hours)}
                          title="Booked — click to see available alternatives"
                          className="w-full rounded border border-rose-200 bg-rose-50 py-1.5 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
                        >
                          Booked
                        </button>
                      </td>
                    );
                  }
                  return (
                    <td key={h.hour} className="p-1 text-center">
                      <button
                        type="button"
                        aria-pressed={chosen}
                        onClick={() => setPick({ date: day.date, hour: h.hour })}
                        className={`w-full rounded border py-1.5 text-[11px] font-medium transition-colors ${
                          chosen
                            ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600'
                            : 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:border-teal-600 hover:bg-teal-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:border-teal-500'
                        }`}
                      >
                        {chosen ? 'Picked' : 'Free'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
          <span>Session duration</span>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {Array.from({ length: MAX_BOOKING_HOURS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} hour{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={!pick || busy}
          onClick={() => pick && void book(equipment.id, pick.date, pick.hour, hours)}
          className="rounded-lg bg-teal-700 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {pick
            ? `Confirm booking · ${formatRange(pick.date, pick.hour, pick.hour + hours)}`
            : 'Select a free slot above'}
        </button>
      </div>

      <div aria-live="polite" className="mt-4 space-y-3">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {alternatives && (
          <AlternativesList
            equipmentId={equipment.id}
            alternatives={alternatives}
            busy={busy}
            onBook={(unitId, w) => void book(unitId, w.date, w.startHour, w.endHour - w.startHour)}
          />
        )}
      </div>
    </section>
  );
}

function AlternativesList({
  equipmentId,
  alternatives,
  busy,
  onBook,
}: {
  equipmentId: string;
  alternatives: Alternatives;
  busy: boolean;
  onBook: (equipmentId: string, window: TimeWindow) => void;
}) {
  const { sameEquipment, equivalents } = alternatives;
  if (sameEquipment.length === 0 && equivalents.length === 0) {
    return (
      <p className="text-xs text-slate-600 dark:text-slate-400">
        No open windows in the next 3 weeks. Submit a Project request so faculty can allocate hours
        fairly.
      </p>
    );
  }
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      {sameEquipment.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Next free slots on this unit
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {sameEquipment.map((w) => (
              <button
                key={`${w.date}-${w.startHour}`}
                type="button"
                disabled={busy}
                onClick={() => onBook(equipmentId, w)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-teal-600 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Book {formatRange(w.date, w.startHour, w.endHour)}
              </button>
            ))}
          </div>
        </div>
      )}
      {equivalents.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Same time on an equivalent unit in another lab
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {equivalents.map((w) => (
              <button
                key={w.equipment.id}
                type="button"
                disabled={busy}
                onClick={() => onBook(w.equipment.id, w)}
                className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-medium text-teal-800 hover:border-teal-600 hover:bg-teal-50 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-300"
              >
                {w.equipment.name} · {w.equipment.labName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
