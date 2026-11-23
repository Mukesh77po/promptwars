import type {
  AccessRequest,
  AllocationResult,
  Booking,
  Department,
  EquipmentView,
  Notification,
  Role,
  SearchResponse,
  User,
  UtilisationReport,
} from './shared/types.ts';

const TOKEN_KEY = 'lablink_session_token';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null;
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['x-lablink-session'] = token;

  const res = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    credentials: 'same-origin',
    headers: Object.keys(headers).length ? headers : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: { message?: string } }).error?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export interface DemoUser {
  id: string;
  name: string;
  role: Role;
  department: string;
}

export interface RequestView extends AccessRequest {
  studentName: string;
  equipmentName: string;
  labName: string;
  freeHoursBeforeDeadline: number;
  risks: string[];
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

export interface PlanResult extends AllocationResult {
  studentName: string;
  projectTitle: string;
  deadline: string;
  explanation: string;
  ranges: (TimeWindow & { equipmentId: string; equipmentName: string; labName: string })[];
}

export interface Plan {
  generatedAt: string;
  summary: string;
  source: 'ai' | 'template';
  results: PlanResult[];
}

export interface ConflictGroup {
  equivalentGroup: string;
  category: string;
  requestIds: string[];
  hoursDemanded: number;
  freeHours: number;
}

export interface Draft {
  projectTitle: string;
  description: string;
  equipmentId: string;
  hoursNeeded: number;
  rationale: string;
  source: 'ai' | 'heuristic';
}

export interface TrackedBooking extends Booking {
  equipment: EquipmentView | null;
  studentName: string;
  overdue: boolean;
  accruingFine?: number;
}

export interface DeskView {
  out: TrackedBooking[];
  toCollect: TrackedBooking[];
  returned: TrackedBooking[];
  overdueCount: number;
  unpaidFines: number;
}

export const api = {
  demoUsers: () => call<{ users: DemoUser[] }>('/session/users'),
  session: () => call<{ user: User | null; aiEnabled: boolean }>('/session'),
  signIn: async (userId: string) => {
    const res = await call<{ user: User; aiEnabled: boolean; sessionToken?: string }>('/session', {
      method: 'POST',
      body: { userId },
    });
    if (res.sessionToken) sessionStorage.setItem(TOKEN_KEY, res.sessionToken);
    return res;
  },
  signOut: async () => {
    await call<void>('/session', { method: 'DELETE' }).catch(() => undefined);
    sessionStorage.removeItem(TOKEN_KEY);
  },
  catalog: (params: { department?: string; category?: string; available?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.department) q.set('department', params.department);
    if (params.category) q.set('category', params.category);
    if (params.available) q.set('available', 'true');
    return call<{ items: EquipmentView[]; categories: string[]; departments: Department[] }>(
      `/equipment?${q}`,
    );
  },
  search: (query: string) =>
    call<SearchResponse>('/ai/search', { method: 'POST', body: { query } }),
  availability: (id: string, days = 7) =>
    call<{
      equipment: EquipmentView;
      now: { date: string; hour: number };
      days: { date: string; hours: { hour: number; booked: boolean }[] }[];
    }>(`/equipment/${encodeURIComponent(id)}/availability?days=${days}`),
  book: (body: { equipmentId: string; date: string; startHour: number; hours: number }) =>
    call<{ booking: Booking }>('/bookings', { method: 'POST', body }),
  myBookings: () => call<{ bookings: TrackedBooking[] }>('/bookings/mine'),
  requests: () => call<{ requests: RequestView[] }>('/requests'),
  createRequest: (
    body: Omit<AccessRequest, 'id' | 'studentId' | 'status' | 'submittedAt' | 'facultyNote'>,
  ) => call<{ request: RequestView }>('/requests', { method: 'POST', body }),
  draft: (idea: string) =>
    call<{ draft: Draft }>('/ai/draft-request', { method: 'POST', body: { idea } }),
  summary: (id: string) =>
    call<{ summary: string; source: 'ai' | 'template'; risks: string[] }>(
      `/requests/${encodeURIComponent(id)}/summary`,
      { method: 'POST' },
    ),
  decide: (id: string, decision: 'approve' | 'reject', note?: string) =>
    call<{ request: RequestView; plan?: Plan }>(`/requests/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: note ? { decision, note } : { decision },
    }),
  conflicts: () => call<{ conflicts: ConflictGroup[] }>('/allocations/conflicts'),
  resolve: (requestIds: string[]) =>
    call<{ plan: Plan }>('/allocations/resolve', { method: 'POST', body: { requestIds } }),
  apply: (requestIds: string[]) =>
    call<{ plan: Plan }>('/allocations/apply', { method: 'POST', body: { requestIds } }),
  desk: () => call<DeskView>('/tracking/desk'),
  checkOut: (id: string) =>
    call<{ booking: TrackedBooking }>(`/tracking/${encodeURIComponent(id)}/checkout`, {
      method: 'POST',
    }),
  returnItem: (id: string) =>
    call<{ booking: TrackedBooking }>(`/tracking/${encodeURIComponent(id)}/return`, {
      method: 'POST',
    }),
  payFine: (id: string) =>
    call<{ booking: TrackedBooking }>(`/tracking/${encodeURIComponent(id)}/pay-fine`, {
      method: 'POST',
    }),
  notifications: () => call<{ notifications: Notification[] }>('/notifications'),
  utilisation: () => call<UtilisationReport>('/stats/utilisation'),
};
