import type {
  AccessRequest,
  AllocationResult,
  RequestStatus,
  User,
} from '../../shared/types.ts';
import { HttpError, notFound } from '../errors.ts';
import { Store } from '../store.ts';
import type { CampusClock } from '../time.ts';
import { daysBetween } from '../time.ts';
import { allocate, candidateUnits } from './allocation.ts';
import { freeSlots, mergeSlots, occupiedSlots } from './availability.ts';

export interface NewRequestInput {
  projectTitle: string;
  description: string;
  deadline: string;
  hoursNeeded: number;
  equipmentId: string;
}

export interface RequestView extends AccessRequest {
  studentName: string;
  equipmentName: string;
  equipmentGroup: string;
  labName: string;
  freeHoursBeforeDeadline: number;
  risks: string[];
}

export interface ConflictGroup {
  equivalentGroup: string;
  category: string;
  requestIds: string[];
  hoursDemanded: number;
  freeHours: number;
}

const OUTCOME_STATUS: Record<AllocationResult['outcome'], RequestStatus> = {
  allocated: 'approved',
  partial: 'partial',
  waitlisted: 'waitlisted',
};

export function createRequest(
  store: Store,
  student: User,
  input: NewRequestInput,
  now: CampusClock,
): AccessRequest {
  if (!store.equipment.has(input.equipmentId)) throw notFound('Equipment');
  if (input.deadline < now.date) {
    throw new HttpError(400, 'deadline_past', 'The deadline must be today or later');
  }
  const request: AccessRequest = {
    id: Store.newId('req'),
    studentId: student.id,
    projectTitle: input.projectTitle,
    description: input.description,
    deadline: input.deadline,
    hoursNeeded: input.hoursNeeded,
    equipmentId: input.equipmentId,
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };
  store.requests.set(request.id, request);
  return request;
}

export function assessRisks(request: AccessRequest, freeHours: number, now: CampusClock): string[] {
  const risks: string[] = [];
  const daysLeft = daysBetween(now.date, request.deadline);
  if (daysLeft <= 3) risks.push(`Deadline in ${Math.max(0, daysLeft)} day(s)`);
  if (freeHours < request.hoursNeeded) {
    risks.push(
      `Needs ${request.hoursNeeded} h but only ${freeHours} h free before the deadline (incl. equivalent units)`,
    );
  }
  if (request.hoursNeeded >= 10) risks.push('Large time request — consider splitting across units');
  return risks;
}

export function toView(
  store: Store,
  request: AccessRequest,
  now: CampusClock,
  taken: Set<string> = occupiedSlots(store.allBookings()),
): RequestView {
  const student = store.users.get(request.studentId);
  const equipment = store.equipment.get(request.equipmentId);
  const lab = equipment ? store.labs.get(equipment.labId) : undefined;
  const units = candidateUnits(request, [...store.equipment.values()]);
  const freeHoursBeforeDeadline = units.reduce(
    (s, u) => s + freeSlots(u.id, taken, now, request.deadline).length,
    0,
  );
  return {
    ...request,
    studentName: student?.name ?? 'Unknown student',
    equipmentName: equipment?.name ?? request.equipmentId,
    equipmentGroup: equipment?.equivalentGroup ?? '',
    labName: lab?.name ?? '',
    freeHoursBeforeDeadline,
    risks: assessRisks(request, freeHoursBeforeDeadline, now),
  };
}

export function findConflicts(store: Store, now: CampusClock): ConflictGroup[] {
  const pending = [...store.requests.values()].filter((r) => r.status === 'pending');
  const byGroup = new Map<string, AccessRequest[]>();
  for (const r of pending) {
    const group = store.equipment.get(r.equipmentId)?.equivalentGroup;
    if (!group) continue;
    byGroup.set(group, [...(byGroup.get(group) ?? []), r]);
  }
  const taken = occupiedSlots(store.allBookings());
  const groups: ConflictGroup[] = [];
  for (const [group, reqs] of byGroup) {
    if (reqs.length < 2) continue;
    const latest = reqs.reduce((d, r) => (r.deadline > d ? r.deadline : d), now.date);
    const units = [...store.equipment.values()].filter(
      (e) => e.equivalentGroup === group && e.status === 'available',
    );
    const freeHours = units.reduce((s, u) => s + freeSlots(u.id, taken, now, latest).length, 0);
    groups.push({
      equivalentGroup: group,
      category: units[0]?.category ?? store.equipment.get(reqs[0]!.equipmentId)?.category ?? group,
      requestIds: reqs.map((r) => r.id),
      hoursDemanded: reqs.reduce((s, r) => s + r.hoursNeeded, 0),
      freeHours,
    });
  }
  return groups;
}

export function runAllocationForIds(
  store: Store,
  requestIds: string[],
  now: CampusClock,
  commit: boolean,
): AllocationResult[] {
  const requests = requestIds
    .map((id) => store.requests.get(id))
    .filter((r): r is AccessRequest => Boolean(r));
  if (requests.length === 0) throw notFound('Requests');

  const results = allocate({
    requests,
    equipment: [...store.equipment.values()],
    bookings: store.allBookings(),
    users: store.users,
    now,
  });

  if (commit) {
    for (const res of results) {
      const req = store.requests.get(res.requestId);
      if (!req) continue;
      req.status = OUTCOME_STATUS[res.outcome];
      const student = store.users.get(req.studentId);
      if (student && res.outcome === 'waitlisted') {
        student.recentDenials += 1;
      }
      for (const range of mergeSlots(res.slots)) {
        store.addBooking({
          id: Store.newId('bk'),
          equipmentId: range.equipmentId,
          userId: req.studentId,
          date: range.date,
          startHour: range.startHour,
          endHour: range.endHour,
          requestId: req.id,
          status: 'scheduled',
        });
      }
    }
  }

  return results;
}
