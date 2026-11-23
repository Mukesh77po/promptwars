export interface CampusClock {
  date: string;
  hour: number;
}

const MS_PER_DAY = 86_400_000;

export function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return formatIsoDate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / MS_PER_DAY);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const total = daysBetween(from, to);
  for (let i = 0; i <= total; i++) out.push(addDays(from, i));
  return out;
}

export function weekBounds(date: string): { start: string; end: string } {
  const d = parseDate(date);
  const dow = (d.getUTCDay() + 6) % 7;
  const start = addDays(date, -dow);
  return { start, end: addDays(start, 6) };
}

export function currentCampusClock(): CampusClock {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const date = ist.toISOString().slice(0, 10);
  const hour = ist.getUTCHours();
  return { date, hour };
}
