import { FINE_CAP, FINE_PER_HOUR } from '../../shared/constants.ts';
import type { Booking, EquipmentView, User } from '../../shared/types.ts';
import { forbidden, HttpError, notFound } from '../errors.ts';
import type { Store } from '../store.ts';
import type { CampusClock } from '../time.ts';
import { daysBetween } from '../time.ts';

export const statusOf = (b: Booking) => b.status ?? 'scheduled';

export function isOverdue(b: Booking, now: CampusClock): boolean {
  if (statusOf(b) !== 'checked_out') return false;
  return b.date < now.date || (b.date === now.date && now.hour >= b.endHour);
}

export function overdueHours(b: Booking, now: CampusClock): number {
  const hours = daysBetween(b.date, now.date) * 24 + now.hour - b.endHour + 1;
  return Math.max(1, hours);
}

export const fineFor = (hours: number): number => Math.min(FINE_CAP, hours * FINE_PER_HOUR);

function getBooking(store: Store, id: string): Booking {
  const booking = store.allBookings().find((b) => b.id === id);
  if (!booking) throw notFound('Booking');
  return booking;
}

export function checkOut(store: Store, bookingId: string, now: CampusClock): Booking {
  const booking = getBooking(store, bookingId);
  if (statusOf(booking) !== 'scheduled') {
    throw new HttpError(409, 'invalid_state', 'This booking has already been checked out');
  }
  if (booking.date > now.date) {
    throw new HttpError(409, 'too_early', 'Equipment can be handed out on the booking day');
  }
  booking.status = 'checked_out';
  booking.checkedOutAt = new Date().toISOString();
  return booking;
}

export function returnItem(store: Store, bookingId: string, now: CampusClock): Booking {
  const booking = getBooking(store, bookingId);
  if (statusOf(booking) !== 'checked_out') {
    throw new HttpError(409, 'invalid_state', 'Only checked-out equipment can be returned');
  }
  if (isOverdue(booking, now)) {
    const hours = overdueHours(booking, now);
    booking.fine = { amount: fineFor(hours), overdueHours: hours, paid: false };
    const student = store.users.get(booking.userId);
    if (student) student.overdueStrikes = (student.overdueStrikes ?? 0) + 1;
  }
  booking.status = 'returned';
  booking.returnedAt = new Date().toISOString();
  return booking;
}

export function payFine(store: Store, user: User, bookingId: string): Booking {
  const booking = getBooking(store, bookingId);
  if (booking.userId !== user.id) throw forbidden();
  if (!booking.fine || booking.fine.paid) {
    throw new HttpError(409, 'no_fine', 'There is no unpaid fine on this booking');
  }
  booking.fine.paid = true;
  booking.fine.paidAt = new Date().toISOString();
  return booking;
}

export interface TrackedBooking extends Booking {
  equipment: EquipmentView | null;
  studentName: string;
  overdue: boolean;
  accruingFine?: number;
}

export function track(store: Store, b: Booking, now: CampusClock): TrackedBooking {
  const e = store.equipment.get(b.equipmentId);
  const overdue = isOverdue(b, now);
  return {
    ...b,
    status: statusOf(b),
    equipment: e ? store.equipmentView(e) : null,
    studentName: store.users.get(b.userId)?.name ?? 'Unknown student',
    overdue,
    accruingFine: overdue ? fineFor(overdueHours(b, now)) : undefined,
  };
}

export function deskView(store: Store, now: CampusClock) {
  const all = store.allBookings();
  const out = all
    .filter((b) => statusOf(b) === 'checked_out')
    .map((b) => track(store, b, now))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.date.localeCompare(b.date));
  const toCollect = all
    .filter((b) => statusOf(b) === 'scheduled' && b.date === now.date)
    .sort((a, b) => a.startHour - b.startHour)
    .map((b) => track(store, b, now));
  const returned = all
    .filter((b) => statusOf(b) === 'returned')
    .sort((a, b) => (b.returnedAt ?? '').localeCompare(a.returnedAt ?? ''))
    .slice(0, 10)
    .map((b) => track(store, b, now));
  return {
    out,
    toCollect,
    returned,
    overdueCount: out.filter((b) => b.overdue).length,
    unpaidFines: all.filter((b) => b.fine && !b.fine.paid).reduce((s, b) => s + b.fine!.amount, 0),
  };
}
