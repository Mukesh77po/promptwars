import { CLOSE_HOUR, OPEN_HOUR } from '../../shared/constants.ts';
import type { Booking, Slot } from '../../shared/types.ts';
import type { CampusClock } from '../time.ts';
import { dateRange } from '../time.ts';

export const slotKey = (equipmentId: string, date: string, hour: number) =>
  `${equipmentId}|${date}|${hour}`;

export function occupiedSlots(bookings: readonly Booking[]): Set<string> {
  const taken = new Set<string>();
  for (const b of bookings) {
    for (let h = b.startHour; h < b.endHour; h++) {
      taken.add(slotKey(b.equipmentId, b.date, h));
    }
  }
  return taken;
}

export function hasOverlap(
  taken: Set<string>,
  q: { equipmentId: string; date: string; startHour: number; endHour: number },
): boolean {
  for (let h = q.startHour; h < q.endHour; h++) {
    if (taken.has(slotKey(q.equipmentId, q.date, h))) return true;
  }
  return false;
}

export function freeSlots(
  equipmentId: string,
  taken: Set<string>,
  now: CampusClock,
  lastDate: string,
): Slot[] {
  const out: Slot[] = [];
  if (lastDate < now.date) return out;
  for (const date of dateRange(now.date, lastDate)) {
    const first = date === now.date ? Math.max(OPEN_HOUR, now.hour + 1) : OPEN_HOUR;
    for (let h = first; h < CLOSE_HOUR; h++) {
      if (!taken.has(slotKey(equipmentId, date, h))) {
        out.push({ equipmentId, date, hour: h });
      }
    }
  }
  return out;
}

export interface MergedRange {
  equipmentId: string;
  date: string;
  startHour: number;
  endHour: number;
}

export function mergeSlots(slots: readonly Slot[]): MergedRange[] {
  if (slots.length === 0) return [];
  const sorted = [...slots].sort(
    (a, b) =>
      a.equipmentId.localeCompare(b.equipmentId) ||
      a.date.localeCompare(b.date) ||
      a.hour - b.hour,
  );
  const out: MergedRange[] = [];
  for (const s of sorted) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.equipmentId === s.equipmentId &&
      prev.date === s.date &&
      prev.endHour === s.hour
    ) {
      prev.endHour = s.hour + 1;
    } else {
      out.push({
        equipmentId: s.equipmentId,
        date: s.date,
        startHour: s.hour,
        endHour: s.hour + 1,
      });
    }
  }
  return out;
}

export function dailyGrid(
  equipmentId: string,
  bookings: readonly Booking[],
  fromDate: string,
  days: number,
) {
  const taken = occupiedSlots(bookings);
  const out: { date: string; hours: { hour: number; booked: boolean }[] }[] = [];
  const d0 = new Date(`${fromDate}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const d = new Date(d0);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const hours: { hour: number; booked: boolean }[] = [];
    for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
      hours.push({ hour: h, booked: taken.has(slotKey(equipmentId, date, h)) });
    }
    out.push({ date, hours });
  }
  return out;
}
