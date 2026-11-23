import type {
  AccessRequest,
  Booking,
  Department,
  Equipment,
  Lab,
  User,
} from '../shared/types.ts';
import { addDays } from './time.ts';
import { departments, equipmentSeed, labs, users } from './catalog.ts';

export interface Dataset {
  departments: Department[];
  labs: Lab[];
  equipment: Equipment[];
  users: User[];
  bookings: Booking[];
  requests: AccessRequest[];
}

type DayOffset = (offset: number) => string;

function demoBookings(d: DayOffset): Booking[] {
  return [
    {
      id: 'bk-1',
      equipmentId: 'printer-mech-1',
      userId: 'stu-vikram',
      date: d(0),
      startHour: 9,
      endHour: 13,
    },
    {
      id: 'bk-2',
      equipmentId: 'printer-des-1',
      userId: 'stu-karthik',
      date: d(0),
      startHour: 9,
      endHour: 13,
    },
    {
      id: 'bk-3',
      equipmentId: 'printer-mech-1',
      userId: 'stu-priya',
      date: d(1),
      startHour: 9,
      endHour: 12,
    },
    {
      id: 'bk-4',
      equipmentId: 'scope-1',
      userId: 'stu-karthik',
      date: d(1),
      startHour: 10,
      endHour: 12,
    },
    {
      id: 'bk-5',
      equipmentId: 'scope-1',
      userId: 'stu-siddharth',
      date: d(1),
      startHour: 14,
      endHour: 16,
    },
    {
      id: 'bk-6',
      equipmentId: 'gpu-ws-1',
      userId: 'stu-karthik',
      date: d(1),
      startHour: 13,
      endHour: 17,
    },
    {
      id: 'bk-7',
      equipmentId: 'gpu-ws-1',
      userId: 'stu-vikram',
      date: d(2),
      startHour: 9,
      endHour: 17,
    },
    {
      id: 'bk-8',
      equipmentId: 'fpga-1',
      userId: 'stu-priya',
      date: d(2),
      startHour: 13,
      endHour: 16,
    },
    {
      id: 'bk-9',
      equipmentId: 'printer-mech-1',
      userId: 'stu-karthik',
      date: d(3),
      startHour: 9,
      endHour: 17,
    },
    {
      id: 'bk-10',
      equipmentId: 'printer-des-1',
      userId: 'stu-vikram',
      date: d(1),
      startHour: 9,
      endHour: 13,
    },
    {
      id: 'bk-11',
      equipmentId: 'printer-des-1',
      userId: 'stu-priya',
      date: d(1),
      startHour: 13,
      endHour: 17,
    },
    {
      id: 'bk-12',
      equipmentId: 'printer-mech-1',
      userId: 'stu-priya',
      date: d(2),
      startHour: 9,
      endHour: 13,
    },
    {
      id: 'bk-13',
      equipmentId: 'gpu-ws-1',
      userId: 'stu-karthik',
      date: d(4),
      startHour: 9,
      endHour: 13,
    },
  ];
}

function trackingBookings(d: DayOffset): Booking[] {
  return [
    {
      id: 'bk-14',
      equipmentId: 'solder-1',
      userId: 'stu-karthik',
      date: d(-1),
      startHour: 14,
      endHour: 16,
      status: 'checked_out',
      checkedOutAt: `${d(-1)}T08:30:00Z`,
    },
    {
      id: 'bk-15',
      equipmentId: 'spectro-1',
      userId: 'stu-siddharth',
      date: d(-1),
      startHour: 9,
      endHour: 11,
      status: 'returned',
      checkedOutAt: `${d(-1)}T03:30:00Z`,
      returnedAt: `${d(-1)}T08:30:00Z`,
      fine: { amount: 150, overdueHours: 3, paid: false },
    },
    {
      id: 'bk-16',
      equipmentId: 'fpga-2',
      userId: 'stu-ananya',
      date: d(0),
      startHour: 9,
      endHour: 17,
      status: 'checked_out',
      checkedOutAt: `${d(0)}T03:30:00Z`,
    },
  ];
}

function demoRequests(d: DayOffset): AccessRequest[] {
  return [
    {
      id: 'req-1',
      studentId: 'stu-siddharth',
      projectTitle: 'Drone frame prototype',
      description: 'Print and test-fit a lightweight quadcopter frame for the design review.',
      deadline: d(1),
      hoursNeeded: 6,
      equipmentId: 'printer-mech-1',
      status: 'pending',
      submittedAt: `${d(-2)}T10:00:00Z`,
    },
    {
      id: 'req-2',
      studentId: 'stu-ananya',
      projectTitle: 'Assistive grip handle',
      description:
        'Iterate three versions of an ergonomic grip for an accessibility product study.',
      deadline: d(3),
      hoursNeeded: 10,
      equipmentId: 'printer-mech-1',
      status: 'pending',
      submittedAt: `${d(-1)}T09:30:00Z`,
    },
    {
      id: 'req-3',
      studentId: 'stu-vikram',
      projectTitle: 'Sensor enclosure batch',
      description: 'Print weatherproof enclosures for 10 IoT air-quality nodes.',
      deadline: d(3),
      hoursNeeded: 14,
      equipmentId: 'printer-mech-1',
      status: 'pending',
      submittedAt: `${d(-3)}T15:00:00Z`,
    },
    {
      id: 'req-4',
      studentId: 'stu-priya',
      projectTitle: 'CNN accelerator on FPGA',
      description: 'Synthesize and benchmark a small convolution accelerator in Verilog.',
      deadline: d(4),
      hoursNeeded: 12,
      equipmentId: 'fpga-1',
      status: 'pending',
      submittedAt: `${d(-1)}T11:15:00Z`,
    },
  ];
}

export function createSeed(today: string): Dataset {
  const d: DayOffset = (offset) => addDays(today, offset);
  const equipment: Equipment[] = equipmentSeed.map((e) => ({
    ...e,
    status: e.status ?? 'available',
  }));
  return {
    departments,
    labs,
    equipment,
    users,
    bookings: [...demoBookings(d), ...trackingBookings(d)],
    requests: demoRequests(d),
  };
}
