import type { Booking, Notification, User } from '../../shared/types.ts';
import type { Store } from '../store.ts';
import type { CampusClock } from '../time.ts';
import { addDays } from '../time.ts';
import { fineFor, isOverdue, overdueHours, statusOf } from './tracking.ts';

const STATUS_COPY = {
  approved: { tone: 'ok', verb: 'was approved and scheduled' },
  partial: { tone: 'warn', verb: 'was partially approved' },
  waitlisted: { tone: 'warn', verb: 'was waitlisted' },
  rejected: { tone: 'bad', verb: 'was not approved' },
} as const;

const equipmentName = (store: Store, id: string) => store.equipment.get(id)?.name ?? 'Equipment';

function facultyNotifications(store: Store, now: CampusClock): Notification[] {
  const out: Notification[] = [];
  const pending = [...store.requests.values()].filter((r) => r.status === 'pending').length;
  if (pending) {
    out.push({
      id: 'pending',
      tone: 'info',
      title: `${pending} request${pending > 1 ? 's' : ''} waiting for approval`,
      detail: 'Open Approvals to review and schedule.',
    });
  }
  for (const b of store.allBookings().filter((x) => isOverdue(x, now))) {
    const student = store.users.get(b.userId)?.name ?? 'A student';
    out.push({
      id: `overdue-${b.id}`,
      tone: 'bad',
      title: `${equipmentName(store, b.equipmentId)} is overdue`,
      detail: `${student} has not returned it (${overdueHours(b, now)} h late).`,
    });
  }
  return out;
}

function bookingNotice(store: Store, b: Booking, now: CampusClock): Notification | null {
  const name = equipmentName(store, b.equipmentId);
  if (isOverdue(b, now)) {
    const hours = overdueHours(b, now);
    return {
      id: `overdue-${b.id}`,
      tone: 'bad',
      title: `Return ${name} now`,
      detail: `It is ${hours} h overdue; a fine of ₹${fineFor(hours)} is accruing.`,
    };
  }
  if (b.fine && !b.fine.paid) {
    return {
      id: `fine-${b.id}`,
      tone: 'warn',
      title: `Unpaid fine: ₹${b.fine.amount}`,
      detail: `Late return of ${name}. Settle it from My bookings.`,
    };
  }
  const soon = b.date === now.date || b.date === addDays(now.date, 1);
  if (statusOf(b) !== 'scheduled' || !soon) return null;
  const when = b.date === now.date ? 'today' : 'tomorrow';
  return {
    id: `soon-${b.id}`,
    tone: 'info',
    title: `${name} ${when} at ${b.startHour}:00`,
    detail: 'Collect it from the lab at the start of your slot.',
  };
}

function studentNotifications(store: Store, user: User, now: CampusClock): Notification[] {
  const bookingNotices = store
    .allBookings()
    .filter((b) => b.userId === user.id)
    .map((b) => bookingNotice(store, b, now))
    .filter((n): n is Notification => n !== null);

  const decisions = [...store.requests.values()]
    .filter((r) => r.studentId === user.id && r.status !== 'pending')
    .map((r): Notification => {
      const copy = STATUS_COPY[r.status as keyof typeof STATUS_COPY];
      return {
        id: `request-${r.id}`,
        tone: copy.tone,
        title: `"${r.projectTitle}" ${copy.verb}`,
        detail: r.facultyNote
          ? `Faculty note: ${r.facultyNote}`
          : 'See Project requests for details.',
      };
    });

  return [...bookingNotices, ...decisions];
}

export function notificationsFor(store: Store, user: User, now: CampusClock): Notification[] {
  return user.role === 'faculty'
    ? facultyNotifications(store, now)
    : studentNotifications(store, user, now);
}
