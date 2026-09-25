import { addDays, diffDays, startOfWeek, type IsoDay } from "./dates";
import type { Category, Entry } from "./types";

export type CategoryStats = {
  category: Category;
  entries: number;
  activeDays: number;
  /** Days since the first entry (inclusive of today) with nothing logged. */
  missedDays: number;
  /** Summed quantity, or null if the category never records quantities. */
  totalQuantity: number | null;
  currentStreak: number;
  longestStreak: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  firstDay: IsoDay | null;
  lastDay: IsoDay | null;
};

export type MonthBucket = { month: string; active: number; missed: number };

export function categoryStats(
  category: Category,
  allEntries: Entry[],
  today: IsoDay,
  weekStart: 0 | 1,
): CategoryStats {
  const entries = allEntries.filter((e) => e.categoryId === category.id && e.day <= today);
  const days = [...new Set(entries.map((e) => e.day))].sort();
  const firstDay = days[0] ?? null;
  const lastDay = days.at(-1) ?? null;

  const hasQuantity = entries.some((e) => e.quantity != null);
  const totalQuantity = hasQuantity
    ? entries.reduce((sum, e) => sum + (e.quantity ?? 0), 0)
    : null;

  const span = firstDay ? diffDays(firstDay, today) + 1 : 0;
  const weekFrom = startOfWeek(today, weekStart);
  const monthFrom = `${today.slice(0, 7)}-01`;
  const yearFrom = `${today.slice(0, 4)}-01-01`;

  return {
    category,
    entries: entries.length,
    activeDays: days.length,
    missedDays: Math.max(0, span - days.length),
    totalQuantity,
    ...streaks(days, today),
    thisWeek: days.filter((d) => d >= weekFrom).length,
    thisMonth: days.filter((d) => d >= monthFrom).length,
    thisYear: days.filter((d) => d >= yearFrom).length,
    firstDay,
    lastDay,
  };
}

/**
 * `days` must be sorted and unique. The current streak still counts if today
 * hasn't been logged yet — it only breaks once a whole day is missed.
 */
export function streaks(days: IsoDay[], today: IsoDay) {
  let longest = 0;
  let run = 0;
  let prev: IsoDay | null = null;
  for (const d of days) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const last = days.at(-1);
  const current =
    last && (last === today || last === addDays(today, -1)) ? run : 0;
  return { currentStreak: current, longestStreak: longest };
}

/** Active vs missed days per month for the last `months` months, oldest first. */
export function monthlyActivity(
  categoryId: string,
  entries: Entry[],
  today: IsoDay,
  months = 12,
): MonthBucket[] {
  const active = new Map<string, Set<IsoDay>>();
  for (const e of entries) {
    if (e.categoryId !== categoryId || e.day > today) continue;
    const m = e.day.slice(0, 7);
    if (!active.has(m)) active.set(m, new Set());
    active.get(m)!.add(e.day);
  }

  // Days before the category's first entry aren't "missed" — it wasn't tracked yet.
  const firstDay = [...active.values()].flatMap((s) => [...s]).sort()[0] ?? today;

  const buckets: MonthBucket[] = [];
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  for (let i = 0; i < months; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const monthStart = `${key}-01`;
    const monthEnd = i === 0 ? today : addDays(`${m === 12 ? y + 1 : y}-${String((m % 12) + 1).padStart(2, "0")}-01`, -1);
    const from = firstDay > monthStart ? firstDay : monthStart;
    const tracked = from > monthEnd ? 0 : diffDays(from, monthEnd) + 1;
    const n = active.get(key)?.size ?? 0;
    buckets.unshift({ month: key, active: n, missed: Math.max(0, tracked - n) });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return buckets;
}
