import type { IsoDay } from "./dates";
import type { Category, Entry } from "./types";

/** 0 = nothing logged, 4 = darkest. */
export type Level = 0 | 1 | 2 | 3 | 4;

/** How much of the category colour is mixed into the empty-cell colour. */
export const LEVEL_MIX: Record<Level, number> = { 0: 0, 1: 30, 2: 52, 3: 76, 4: 100 };

export type DayCell = {
  level: Level;
  /** Colour to shade with; null when nothing is logged. */
  color: string | null;
  value: number;
};

/**
 * Map each day to a shade.
 *
 * - One category selected: the value is the day's summed quantity, or the
 *   number of entries when none of them has a quantity.
 * - All categories: the value is the number of entries, shaded in the colour
 *   of the category logged most that day.
 *
 * Levels scale against the 90th percentile of non-zero values rather than the
 * max, so one marathon day doesn't wash every other day out to the lightest shade.
 */
export function shadeDays(
  entries: Entry[],
  categories: Category[],
  categoryId: string | null,
): Map<IsoDay, DayCell> {
  const colorOf = new Map(categories.map((c) => [c.id, c.color]));
  const orderOf = new Map(categories.map((c) => [c.id, c.sortOrder]));

  const values = new Map<IsoDay, number>();
  const counts = new Map<IsoDay, Map<string, number>>();

  if (categoryId) {
    const scoped = entries.filter((e) => e.categoryId === categoryId);
    const useQuantity = scoped.some((e) => e.quantity != null && e.quantity > 0);
    for (const e of scoped) {
      const v = useQuantity ? (e.quantity ?? 0) : 1;
      values.set(e.day, (values.get(e.day) ?? 0) + v);
    }
  } else {
    for (const e of entries) {
      values.set(e.day, (values.get(e.day) ?? 0) + 1);
      const perCat = counts.get(e.day) ?? new Map<string, number>();
      perCat.set(e.categoryId, (perCat.get(e.categoryId) ?? 0) + 1);
      counts.set(e.day, perCat);
    }
  }

  const cap = percentile([...values.values()].filter((v) => v > 0), 0.9);
  const cells = new Map<IsoDay, DayCell>();

  for (const [day, value] of values) {
    let color: string | null;
    if (categoryId) {
      color = colorOf.get(categoryId) ?? null;
    } else {
      color = dominant(counts.get(day)!, orderOf);
      color = color ? (colorOf.get(color) ?? null) : null;
    }
    cells.set(day, { level: levelFor(value, cap), color, value });
  }
  return cells;
}

export function levelFor(value: number, cap: number): Level {
  if (value <= 0 || cap <= 0) return value > 0 ? 4 : 0;
  const ratio = Math.min(value / cap, 1);
  return Math.max(1, Math.ceil(ratio * 4)) as Level;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

/** Category with the most entries; ties go to the earlier category in the list. */
function dominant(perCat: Map<string, number>, orderOf: Map<string, number>): string | null {
  let best: string | null = null;
  for (const [id, n] of perCat) {
    if (
      best === null ||
      n > perCat.get(best)! ||
      (n === perCat.get(best)! && (orderOf.get(id) ?? 0) < (orderOf.get(best) ?? 0))
    ) {
      best = id;
    }
  }
  return best;
}

/** CSS colour for a cell. The empty colour comes from the theme. */
export function cellBackground(cell: DayCell | undefined): string {
  if (!cell || cell.level === 0 || !cell.color) return "var(--cell-empty)";
  const mix = LEVEL_MIX[cell.level];
  return `color-mix(in oklab, ${cell.color} ${mix}%, var(--cell-empty))`;
}
