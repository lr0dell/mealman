export interface WeekRange {
  start: string; // YYYY-MM-DD (Monday)
  end: string; // YYYY-MM-DD (Sunday)
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekRange(date?: Date): WeekRange {
  const d = date ?? new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = (day + 6) % 7; // days since Monday

  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: formatDate(monday), end: formatDate(sunday) };
}

export function toWeekKey(range: WeekRange): string {
  return `${range.start}--${range.end}`;
}

export function parseWeekKey(key: string): WeekRange {
  const [start, end] = key.split('--');
  return { start, end };
}

export function getWeekDates(weekKey: string): string[] {
  const { start } = parseWeekKey(weekKey);
  const monday = new Date(start + 'T12:00:00');
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(formatDate(d));
  }
  return dates;
}

export function getCurrentWeekKey(): string {
  return toWeekKey(getWeekRange());
}
