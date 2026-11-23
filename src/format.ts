export function formatHour(hour: number): string {
  const h = String(hour).padStart(2, '0');
  return `${h}:00`;
}

export function formatDate(date: string): string {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function formatRange(date: string, startHour: number, endHour: number): string {
  return `${formatDate(date)}, ${formatHour(startHour)}–${formatHour(endHour)}`;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}
