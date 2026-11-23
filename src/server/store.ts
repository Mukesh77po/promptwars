import crypto from 'node:crypto';
import type {
  AccessRequest,
  Booking,
  Department,
  Equipment,
  EquipmentView,
  Lab,
  User,
} from '../shared/types.ts';
import type { Dataset } from './seed.ts';

export class Store {
  readonly departments: Map<string, Department>;
  readonly labs: Map<string, Lab>;
  readonly equipment: Map<string, Equipment>;
  readonly users: Map<string, User>;
  readonly requests: Map<string, AccessRequest>;
  readonly sessions = new Map<string, string>();
  private readonly bookings: Booking[];

  constructor(data: Dataset) {
    this.departments = new Map(data.departments.map((d) => [d.id, d]));
    this.labs = new Map(data.labs.map((l) => [l.id, l]));
    this.equipment = new Map(data.equipment.map((e) => [e.id, e]));
    this.users = new Map(data.users.map((u) => [u.id, { ...u }]));
    this.requests = new Map(data.requests.map((r) => [r.id, { ...r }]));
    this.bookings = data.bookings.map((b) => ({ ...b, fine: b.fine ? { ...b.fine } : undefined }));
  }

  allBookings(): readonly Booking[] {
    return this.bookings;
  }

  bookingsFor(equipmentId: string): Booking[] {
    return this.bookings.filter((b) => b.equipmentId === equipmentId);
  }

  addBooking(booking: Booking): void {
    this.bookings.push(booking);
  }

  equipmentView(e: Equipment): EquipmentView {
    const lab = this.labs.get(e.labId);
    const dept = lab ? this.departments.get(lab.departmentId) : undefined;
    return {
      ...e,
      departmentId: lab?.departmentId ?? '',
      labName: lab?.name ?? '',
      departmentName: dept?.name ?? '',
      location: lab?.location ?? '',
    };
  }

  static newId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
}
