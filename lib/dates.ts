/**
 * Calendar days are handled as ISO `YYYY-MM-DD` strings everywhere. Arithmetic
 * goes through UTC midnight so a day never shifts under DST or the server's
 * timezone — "today" is the only value that depends on the viewer's clock.
 */

export type IsoDay = string;

export function parseDay(iso: IsoDay): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function formatDay(date: Date): IsoDay {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: IsoDay, n: number): IsoDay {
  const d = parseDay(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDay(d);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(iso: IsoDay): number {
  return parseDay(iso).getUTCDay();
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: IsoDay, b: IsoDay): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/** The first day of the week containing `iso`. */
export function startOfWeek(iso: IsoDay, weekStart: 0 | 1): IsoDay {
  const offset = (weekday(iso) - weekStart + 7) % 7;
  return addDays(iso, -offset);
}

/** Today in the viewer's local timezone. */
export function localToday(now: Date = new Date()): IsoDay {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidDay(iso: string): iso is IsoDay {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && formatDay(parseDay(iso)) === iso;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function monthLabel(iso: IsoDay): string {
  return MONTHS[Number(iso.slice(5, 7)) - 1];
}

export function weekdayLabel(day: number): string {
  return WEEKDAYS[day];
}

/** "Thu, 25 Sep 2026" */
export function longDayLabel(iso: IsoDay): string {
  return `${WEEKDAYS[weekday(iso)]}, ${Number(iso.slice(8))} ${monthLabel(iso)} ${iso.slice(0, 4)}`;
}
