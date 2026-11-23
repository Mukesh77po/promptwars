export type Role = 'student' | 'faculty';

export interface Department {
  id: string;
  name: string;
}

export interface Lab {
  id: string;
  name: string;
  departmentId: string;
  location: string;
}

export type EquipmentStatus = 'available' | 'maintenance';

export interface Equipment {
  id: string;
  name: string;
  category: string;
  equivalentGroup: string;
  labId: string;
  specs: string;
  tags: string[];
  status: EquipmentStatus;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  departmentId: string;
  recentDenials: number;
  overdueStrikes?: number;
}

export type BookingStatus = 'scheduled' | 'checked_out' | 'returned';

export interface Fine {
  amount: number;
  overdueHours: number;
  paid: boolean;
  paidAt?: string;
}

export interface Booking {
  id: string;
  equipmentId: string;
  userId: string;
  date: string;
  startHour: number;
  endHour: number;
  requestId?: string;
  status?: BookingStatus;
  checkedOutAt?: string;
  returnedAt?: string;
  fine?: Fine;
}

export interface Notification {
  id: string;
  tone: 'info' | 'ok' | 'warn' | 'bad';
  title: string;
  detail: string;
}

export type RequestStatus = 'pending' | 'approved' | 'partial' | 'waitlisted' | 'rejected';

export interface AccessRequest {
  id: string;
  studentId: string;
  projectTitle: string;
  description: string;
  deadline: string;
  hoursNeeded: number;
  equipmentId: string;
  status: RequestStatus;
  submittedAt: string;
  facultyNote?: string;
}

export interface Slot {
  equipmentId: string;
  date: string;
  hour: number;
}

export type ReasonCode =
  | 'URGENT_DEADLINE'
  | 'FAIRNESS_PRIORITY'
  | 'HEAVY_RECENT_USAGE'
  | 'MOVED_TO_EQUIVALENT'
  | 'INSUFFICIENT_CAPACITY'
  | 'FULLY_ALLOCATED'
  | 'OVERDUE_HISTORY';

export type AllocationOutcome = 'allocated' | 'partial' | 'waitlisted';

export interface AllocationResult {
  requestId: string;
  studentId: string;
  priority: number;
  outcome: AllocationOutcome;
  hoursGranted: number;
  hoursNeeded: number;
  slots: Slot[];
  reasons: ReasonCode[];
  explanation?: string;
}

export interface EquipmentView extends Equipment {
  departmentId: string;
  labName: string;
  departmentName: string;
  location: string;
}

export interface UtilisationRow {
  equipmentId: string;
  name: string;
  labName: string;
  bookedHours: number;
  openHours: number;
  utilisation: number;
}

export interface UtilisationReport {
  windowDays: number;
  overall: number;
  items: UtilisationRow[];
  byDepartment: { departmentId: string; name: string; utilisation: number }[];
  redirects: { from: string; fromName: string; to: string; toName: string; toLab: string }[];
}

export interface SearchMatch {
  equipment: EquipmentView;
  reason: string;
}

export interface SearchResponse {
  source: 'ai' | 'keyword';
  matches: SearchMatch[];
}
