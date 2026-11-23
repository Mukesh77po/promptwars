import { BOOKING_HORIZON_DAYS, CLOSE_HOUR, MAX_BOOKING_HOURS, OPEN_HOUR } from '../../shared/constants.ts';
import type { Booking, EquipmentView } from '../../shared/types.ts';
import { HttpError, notFound } from '../errors.ts';
import { Store } from '../store.ts';
import type { CampusClock } from '../time.ts';
import { addDays, dateRange } from '../time.ts';
import { hasOverlap, occupiedSlots } from './availability.ts';

const ALTERNATIVE_WINDOWS = 3;

export interface BookingInput {
  equipmentId: string;
  date: string;
  startHour: number;
  hours: number;
}

export interface TimeWindow {
  date: string;
  startHour: number;
  endHour: number;
}

export interface Alternatives {
  sameEquipment: TimeWindow[];
  equivalents: (TimeWindow & { equipment: EquipmentView })[];
}

export type BookingOutcome =
  | { ok: true; booking: Booking }
  | { ok: false; reason: 'conflict'; alternatives: Alternatives };

export interface WindowQuery {
  equipmentId: string;
  fromDate: string;
  lastDate: string;
  hours: number;
  limit: number;
}

export function findWindows(taken: Set<string>, now: CampusClock, q: WindowQuery): TimeWindow[] {
  const out: TimeWindow[] = [];
  const start = q.fromDate < now.date ? now.date : q.fromDate;
  for (const date of dateRange(start, q.lastDate)) {
    const first = date === now.date ? Math.max(OPEN_HOUR, now.hour + 1) : OPEN_HOUR;
    let h = first;
    while (h + q.hours <= CLOSE_HOUR && out.length < q.limit) {
      const window = { date, startHour: h, endHour: h + q.hours };
      const free = !hasOverlap(taken, { equipmentId: q.equipmentId, ...window });
      if (free) out.push(window);
      h += free ? q.hours : 1;
    }
  }
  return out;
}

function userBusy(store: Store, userId: string, w: TimeWindow): boolean {
  return store
    .allBookings()
    .some(
      (b) =>
        b.userId === userId &&
        b.date === w.date &&
        b.startHour < w.endHour &&
        w.startHour < b.endHour,
    );
}

export function createBooking(
  store: Store,
  userId: string,
  input: BookingInput,
  now: CampusClock,
): BookingOutcome {
  const equipment = store.equipment.get(input.equipmentId);
  if (!equipment) throw notFound('Equipment');
  if (equipment.status !== 'available') {
    throw new HttpError(409, 'maintenance', 'This unit is currently under maintenance');
  }
  if (input.hours < 1 || input.hours > MAX_BOOKING_HOURS) {
    throw new HttpError(400, 'invalid_hours', `Duration must be between 1 and ${MAX_BOOKING_HOURS} hours`);
  }
  const horizonEnd = addDays(now.date, BOOKING_HORIZON_DAYS);
  if (input.date < now.date || input.date > horizonEnd) {
    throw new HttpError(400, 'invalid_date', `Bookings must be within the next ${BOOKING_HORIZON_DAYS} days`);
  }
  const endHour = input.startHour + input.hours;
  if (input.startHour < OPEN_HOUR || endHour > CLOSE_HOUR) {
    throw new HttpError(400, 'outside_hours', `Labs are open ${OPEN_HOUR}:00–${CLOSE_HOUR}:00`);
  }
  if (input.date === now.date && input.startHour <= now.hour) {
    throw new HttpError(400, 'past_slot', 'Cannot book a slot that has already started');
  }

  const window: TimeWindow = { date: input.date, startHour: input.startHour, endHour };
  if (userBusy(store, userId, window)) {
    throw new HttpError(409, 'user_busy', 'You already have another booking at this time');
  }

  const taken = occupiedSlots(store.allBookings());
  if (!hasOverlap(taken, { equipmentId: equipment.id, ...window })) {
    const booking: Booking = {
      id: Store.newId('bk'),
      equipmentId: equipment.id,
      userId,
      date: window.date,
      startHour: window.startHour,
      endHour: window.endHour,
      status: 'scheduled',
    };
    store.addBooking(booking);
    return { ok: true, booking };
  }

  const sameEquipment = findWindows(taken, now, {
    equipmentId: equipment.id,
    fromDate: input.date,
    lastDate: horizonEnd,
    hours: input.hours,
    limit: ALTERNATIVE_WINDOWS,
  });

  const equivalents = [...store.equipment.values()]
    .filter(
      (e) =>
        e.id !== equipment.id &&
        e.equivalentGroup === equipment.equivalentGroup &&
        e.status === 'available',
    )
    .filter((e) => !hasOverlap(taken, { equipmentId: e.id, ...window }))
    .map((e) => ({
      ...window,
      equipment: store.equipmentView(e),
    }));

  return { ok: false, reason: 'conflict', alternatives: { sameEquipment, equivalents } };
}
