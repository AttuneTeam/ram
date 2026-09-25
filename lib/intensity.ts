import type { IsoDay } from "./dates";
import type { Category, Entry } from "./types";

/** 0 = nothing logged, 4 = darkest. */
export type Level = 0 | 1 | 2 | 3 | 4;

/** How much of the category colour is mixed into the empty-cell colour. */
export const LEVEL_MIX: Record<Level, number> = { 0: 0, 1: 30, 2: 52, 3: 76, 4: 100 };

/** Most categories drawn in one cell. At phone size (15px) more become slivers;
 *  the tooltip still lists every entry. */
export const MAX_BANDS = 4;

/** One category's slice of a day's cell. */
export type Band = { categoryId: string; color: string; level: Level };

export type DayCell = {
  /** Darkest band, so "anything logged?" is `level > 0`. */
  level: Level;
  /** One per category logged that day, in category order, at most MAX_BANDS. */
  bands: Band[];
};

/**
 * Map each day to its shading.
 *
 * Every category is scaled on its own: its value for a day is the summed
 * quantity, or the number of entries if the category never records quantities.
 * Minutes and pages never compete on one scale.
 *
 * - One category selected: one band per day.
 * - All categories: one band per category done that day, in category order,
 *   so each category always sits in the same position.
 *
 * Levels scale against the 90th percentile of a category's non-zero days rather
 * than its max, so one marathon day doesn't wash every other day out to the
 * lightest shade.
 */
export function shadeDays(
  entries: Entry[],
  categories: Category[],
  categoryId: string | null,
): Map<IsoDay, DayCell> {
  const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const shown = categoryId ? ordered.filter((c) => c.id === categoryId) : ordered;

  const byCategory = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = byCategory.get(e.categoryId) ?? [];
    list.push(e);
    byCategory.set(e.categoryId, list);
  }

  const cells = new Map<IsoDay, DayCell>();
  for (const category of shown) {
    const scoped = byCategory.get(category.id) ?? [];
    const useQuantity = scoped.some((e) => e.quantity != null && e.quantity > 0);
    const values = new Map<IsoDay, number>();
    for (const e of scoped) {
      const v = useQuantity ? (e.quantity ?? 0) : 1;
      values.set(e.day, (values.get(e.day) ?? 0) + v);
    }
    const cap = percentile([...values.values()].filter((v) => v > 0), 0.9);

    for (const [day, value] of values) {
      const level = levelFor(value, cap);
      if (level === 0) continue;
      const cell = cells.get(day) ?? { level: 0, bands: [] };
      // Categories are visited in order, so bands are already ordered.
      if (cell.bands.length < MAX_BANDS) {
        cell.bands.push({ categoryId: category.id, color: category.color, level });
        cell.level = Math.max(cell.level, level) as Level;
      }
      cells.set(day, cell);
    }
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

export function shade(color: string, level: Level): string {
  if (level === 0) return "var(--cell-empty)";
  return `color-mix(in oklab, ${color} ${LEVEL_MIX[level]}%, var(--cell-empty))`;
}

/**
 * CSS background for a cell: a flat shade for one category, or equal vertical
 * bands with hard stops for several. The empty colour comes from the theme.
 */
export function cellBackground(cell: DayCell | undefined): string {
  if (!cell || cell.bands.length === 0) return "var(--cell-empty)";
  if (cell.bands.length === 1) return shade(cell.bands[0].color, cell.bands[0].level);
  const step = 100 / cell.bands.length;
  const stops = cell.bands.map((b, i) => {
    const c = shade(b.color, b.level);
    return `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`;
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
