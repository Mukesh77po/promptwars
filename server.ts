import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BOOKING_HORIZON_DAYS, MAX_BOOKING_HOURS } from './src/shared/constants.ts';
import type { AllocationResult, Role, User } from './src/shared/types.ts';
import { HttpError, forbidden, notFound, unauthorized } from './src/server/errors.ts';
import { createSeed } from './src/server/seed.ts';
import { Store } from './src/server/store.ts';
import { currentCampusClock } from './src/server/time.ts';
import {
  aiIsEnabled,
  draftRequest,
  explainPlan,
  semanticSearch,
  summarizeRequest,
} from './src/server/services/ai.ts';
import { dailyGrid, mergeSlots, occupiedSlots } from './src/server/services/availability.ts';
import { createBooking } from './src/server/services/booking.ts';
import { notificationsFor } from './src/server/services/notifications.ts';
import {
  createRequest,
  findConflicts,
  runAllocationForIds,
  toView,
} from './src/server/services/requests.ts';
import { deskView, checkOut, payFine, returnItem, track } from './src/server/services/tracking.ts';
import { utilisationReport } from './src/server/services/stats.ts';

const PORT = Number(process.env.PORT ?? 3000);
const COOKIE_NAME = 'lablink_sid';
const SECRET = process.env.SESSION_SECRET ?? crypto.randomBytes(24).toString('hex');

const clock = currentCampusClock;
const store = new Store(createSeed(clock().date));

function signSid(sid: string): string {
  const sig = crypto.createHmac('sha256', SECRET).update(sid).digest('base64url');
  return `${sid}.${sig}`;
}

function verifySid(token: string): string | null {
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const sid = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(sid).digest('base64url');
  if (sig.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? sid : null;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = decodeURIComponent(part.slice(eq + 1).trim());
    out[key] = val;
  }
  return out;
}

function resolveUser(req: Request): User | null {
  const headerToken = req.header('x-lablink-session');
  const cookieToken = parseCookies(req.headers.cookie)[COOKIE_NAME];
  const raw = headerToken || cookieToken;
  if (!raw) return null;
  const sid = verifySid(raw);
  if (!sid) return null;
  const userId = store.sessions.get(sid);
  return userId ? store.users.get(userId) ?? null : null;
}

function requireUser(req: Request): User {
  const u = resolveUser(req);
  if (!u) throw unauthorized();
  return u;
}

function requireRole(req: Request, role: Role): User {
  const u = requireUser(req);
  if (u.role !== role) throw forbidden(`Only ${role} accounts can access this action`);
  return u;
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? 'Invalid input';
    throw new HttpError(400, 'validation_error', msg, result.error.issues);
  }
  return result.data;
}

async function formatPlan(results: AllocationResult[]) {
  const contexts = results.map((result) => {
    const req = store.requests.get(result.requestId)!;
    const student = store.users.get(result.studentId);
    const eqIds = [...new Set(result.slots.map((s) => s.equipmentId))];
    const equipmentNames = eqIds.map((id) => store.equipment.get(id)?.name ?? id);
    return {
      result,
      studentName: student?.name ?? 'Student',
      projectTitle: req?.projectTitle ?? 'Project',
      deadline: req?.deadline ?? '',
      equipmentNames,
    };
  });

  const explained = await explainPlan(contexts);

  return {
    generatedAt: new Date().toISOString(),
    summary: explained.summary,
    source: explained.source,
    results: contexts.map((ctx) => ({
      ...ctx.result,
      studentName: ctx.studentName,
      projectTitle: ctx.projectTitle,
      deadline: ctx.deadline,
      explanation: explained.explanations.get(ctx.result.requestId) ?? '',
      ranges: mergeSlots(ctx.result.slots).map((r) => {
        const eq = store.equipment.get(r.equipmentId);
        const lab = eq ? store.labs.get(eq.labId) : undefined;
        return {
          ...r,
          equipmentName: eq?.name ?? r.equipmentId,
          labName: lab?.name ?? '',
        };
      }),
    })),
  };
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ai: aiIsEnabled() });
});

app.get('/api/session/users', (_req, res) => {
  const users = [...store.users.values()].map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    department: store.departments.get(u.departmentId)?.name ?? u.departmentId,
  }));
  res.json({ users });
});

app.get('/api/session', (req, res) => {
  res.json({ user: resolveUser(req), aiEnabled: aiIsEnabled() });
});

app.post('/api/session', (req, res) => {
  const { userId } = parse(z.object({ userId: z.string().min(1) }), req.body);
  const user = store.users.get(userId);
  if (!user) throw notFound('User');
  const sid = crypto.randomUUID();
  store.sessions.set(sid, user.id);
  const signed = signSid(sid);
  res.cookie(COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 3600_000,
  });
  res.json({ user, aiEnabled: aiIsEnabled(), sessionToken: signed });
});

app.delete('/api/session', (req, res) => {
  const headerToken = req.header('x-lablink-session');
  const cookieToken = parseCookies(req.headers.cookie)[COOKIE_NAME];
  for (const raw of [headerToken, cookieToken]) {
    if (!raw) continue;
    const sid = verifySid(raw);
    if (sid) store.sessions.delete(sid);
  }
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.status(204).end();
});

app.get('/api/equipment', (req, res) => {
  const department = typeof req.query.department === 'string' ? req.query.department : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const available = req.query.available === 'true';

  const all = [...store.equipment.values()].map((e) => store.equipmentView(e));
  const items = all.filter((e) => {
    if (department && e.departmentId !== department) return false;
    if (category && e.category !== category) return false;
    if (available && e.status !== 'available') return false;
    return true;
  });
  const categories = [...new Set(all.map((e) => e.category))].sort();
  res.json({
    items,
    categories,
    departments: [...store.departments.values()],
  });
});

app.get('/api/equipment/:id/availability', (req, res) => {
  const eq = store.equipment.get(req.params.id);
  if (!eq) throw notFound('Equipment');
  const days = Math.min(BOOKING_HORIZON_DAYS, Math.max(1, Number(req.query.days ?? 7)));
  const now = clock();
  res.json({
    equipment: store.equipmentView(eq),
    now,
    days: dailyGrid(eq.id, store.allBookings(), now.date, days),
  });
});

app.post('/api/bookings', (req, res) => {
  const user = requireUser(req);
  const body = parse(
    z.object({
      equipmentId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startHour: z.number().int().min(0).max(23),
      hours: z.number().int().min(1).max(MAX_BOOKING_HOURS),
    }),
    req.body,
  );
  const outcome = createBooking(store, user.id, body, clock());
  if (outcome.ok) {
    res.status(201).json({ booking: outcome.booking });
    return;
  }
  res.status(409).json({
    error: {
      code: 'slot_conflict',
      message: 'That slot overlaps an existing booking. Pick one of the suggested alternatives.',
    },
    alternatives: outcome.alternatives,
  });
});

app.get('/api/bookings/mine', (req, res) => {
  const user = requireUser(req);
  const now = clock();
  const bookings = store
    .allBookings()
    .filter((b) => b.userId === user.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour)
    .map((b) => track(store, b, now));
  res.json({ bookings });
});

app.get('/api/requests', (req, res) => {
  const user = requireUser(req);
  const now = clock();
  const taken = occupiedSlots(store.allBookings());
  const list = [...store.requests.values()]
    .filter((r) => user.role === 'faculty' || r.studentId === user.id)
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.submittedAt.localeCompare(b.submittedAt))
    .map((r) => toView(store, r, now, taken));
  res.json({ requests: list });
});

app.post('/api/requests', (req, res) => {
  const user = requireRole(req, 'student');
  const body = parse(
    z.object({
      projectTitle: z.string().trim().min(3).max(120),
      description: z.string().trim().min(10).max(1000),
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      hoursNeeded: z.number().int().min(1).max(40),
      equipmentId: z.string().min(1),
    }),
    req.body,
  );
  const now = clock();
  const created = createRequest(store, user, body, now);
  res.status(201).json({ request: toView(store, created, now) });
});

app.post('/api/requests/:id/summary', async (req, res, next) => {
  try {
    requireRole(req, 'faculty');
    const r = store.requests.get(req.params.id);
    if (!r) throw notFound('Request');
    const view = toView(store, r, clock());
    const out = await summarizeRequest({
      projectTitle: view.projectTitle,
      description: view.description,
      studentName: view.studentName,
      equipmentName: view.equipmentName,
      hoursNeeded: view.hoursNeeded,
      deadline: view.deadline,
      freeHours: view.freeHoursBeforeDeadline,
      risks: view.risks,
    });
    res.json({ ...out, risks: view.risks });
  } catch (err) {
    next(err);
  }
});

app.post('/api/requests/:id/decision', async (req, res, next) => {
  try {
    requireRole(req, 'faculty');
    const r = store.requests.get(req.params.id);
    if (!r) throw notFound('Request');
    if (r.status !== 'pending') {
      throw new HttpError(409, 'already_decided', 'This request has already been decided');
    }
    const { decision, note } = parse(
      z.object({
        decision: z.enum(['approve', 'reject']),
        note: z.string().trim().max(400).optional(),
      }),
      req.body,
    );
    const now = clock();
    if (decision === 'reject') {
      r.status = 'rejected';
      if (note) r.facultyNote = note;
      const student = store.users.get(r.studentId);
      if (student) student.recentDenials += 1;
      res.json({ request: toView(store, r, now) });
      return;
    }

    if (note) r.facultyNote = note;
    const results = runAllocationForIds(store, [r.id], now, true);
    const plan = await formatPlan(results);
    res.json({ request: toView(store, r, now), plan });
  } catch (err) {
    next(err);
  }
});

app.get('/api/allocations/conflicts', (req, res) => {
  requireRole(req, 'faculty');
  res.json({ conflicts: findConflicts(store, clock()) });
});

app.post('/api/allocations/resolve', async (req, res, next) => {
  try {
    requireRole(req, 'faculty');
    const { requestIds } = parse(
      z.object({ requestIds: z.array(z.string().min(1)).min(1) }),
      req.body,
    );
    const results = runAllocationForIds(store, requestIds, clock(), false);
    res.json({ plan: await formatPlan(results) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/allocations/apply', async (req, res, next) => {
  try {
    requireRole(req, 'faculty');
    const { requestIds } = parse(
      z.object({ requestIds: z.array(z.string().min(1)).min(1) }),
      req.body,
    );
    const results = runAllocationForIds(store, requestIds, clock(), true);
    res.json({ plan: await formatPlan(results) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/tracking/desk', (req, res) => {
  requireRole(req, 'faculty');
  res.json(deskView(store, clock()));
});

app.post('/api/tracking/:id/checkout', (req, res) => {
  requireRole(req, 'faculty');
  const now = clock();
  res.json({ booking: track(store, checkOut(store, req.params.id, now), now) });
});

app.post('/api/tracking/:id/return', (req, res) => {
  requireRole(req, 'faculty');
  const now = clock();
  res.json({ booking: track(store, returnItem(store, req.params.id, now), now) });
});

app.post('/api/tracking/:id/pay-fine', (req, res) => {
  const user = requireRole(req, 'student');
  const now = clock();
  res.json({ booking: track(store, payFine(store, user, req.params.id), now) });
});

app.get('/api/notifications', (req, res) => {
  const user = requireUser(req);
  res.json({ notifications: notificationsFor(store, user, clock()) });
});

app.post('/api/ai/search', async (req, res, next) => {
  try {
    requireUser(req);
    const { query } = parse(z.object({ query: z.string().trim().min(2).max(240) }), req.body);
    const catalog = [...store.equipment.values()].map((e) => store.equipmentView(e));
    res.json(await semanticSearch(catalog, query));
  } catch (err) {
    next(err);
  }
});

app.post('/api/ai/draft-request', async (req, res, next) => {
  try {
    requireRole(req, 'student');
    const { idea } = parse(z.object({ idea: z.string().trim().min(5).max(500) }), req.body);
    const catalog = [...store.equipment.values()].map((e) => store.equipmentView(e));
    res.json({ draft: await draftRequest(catalog, idea) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/stats/utilisation', (req, res) => {
  requireRole(req, 'faculty');
  res.json(utilisationReport(store, clock()));
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Endpoint not found' } });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error('[server error]', err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Unexpected server error' } });
});

async function start() {
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.get(/^(?!\/api\/).*/, async (req, res, next) => {
      try {
        const htmlPath = path.resolve(process.cwd(), 'index.html');
        const raw = fs.readFileSync(htmlPath, 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, raw);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LabLink running on http://0.0.0.0:${PORT}`);
  });
}

start();
