import { addDays, diffDays, monthLabel, startOfWeek, type IsoDay } from "./dates";

export type Divider = "none" | "month" | "year";

/** One week. `days[i]` is the i-th row (0 = first day of the week), or null
 *  when that slot is outside the visible range or outside its segment. */
export type Column = {
  key: string;
  days: (IsoDay | null)[];
  /** Month label to print above this column, if one starts here. */
  label?: string;
};

/** A run of columns drawn together. With dividers on, each month (or year)
 *  is its own segment, separated by a gap. */
export type Segment = {
  key: string;
  label?: string;
  columns: Column[];
};

export type GridOptions = {
  /** Earliest day that must be visible. */
  from: IsoDay;
  /** Last day drawn (normally today). Later days in its week are left empty. */
  to: IsoDay;
  weekStart: 0 | 1;
  divider: Divider;
};

/** Minimum history shown so a new workspace still looks like a year. */
export const MIN_WEEKS = 53;

/** The first visible day: the earlier of `earliest` and ~a year before `today`. */
export function gridStart(today: IsoDay, earliest: IsoDay | null): IsoDay {
  const yearAgo = addDays(today, -(MIN_WEEKS * 7 - 1));
  return earliest && earliest < yearAgo ? earliest : yearAgo;
}

function segmentKey(day: IsoDay, divider: Divider): string {
  if (divider === "month") return day.slice(0, 7);
  if (divider === "year") return day.slice(0, 4);
  return "all";
}

function segmentLabel(key: string, divider: Divider): string | undefined {
  if (divider === "month") return `${monthLabel(`${key}-01`)} ${key.slice(0, 4)}`;
  if (divider === "year") return key;
  return undefined;
}

export function buildGrid({ from, to, weekStart, divider }: GridOptions): Segment[] {
  const first = startOfWeek(from, weekStart);
  const weekCount = Math.floor(diffDays(first, to) / 7) + 1;

  const segments: Segment[] = [];
  const byKey = new Map<string, Segment>();

  for (let w = 0; w < weekCount; w++) {
    const weekFirst = addDays(first, w * 7);
    // A week can straddle two segments (e.g. 29 Sep – 5 Oct). It then gets a
    // column in each, with the other segment's days blanked out.
    const columnsHere = new Map<string, Column>();

    for (let d = 0; d < 7; d++) {
      const day = addDays(weekFirst, d);
      if (day > to) break;
      const key = segmentKey(day, divider);

      let column = columnsHere.get(key);
      if (!column) {
        column = { key: `${key}:${weekFirst}`, days: Array(7).fill(null) };
        columnsHere.set(key, column);
        let segment = byKey.get(key);
        if (!segment) {
          segment = { key, label: segmentLabel(key, divider), columns: [] };
          byKey.set(key, segment);
          segments.push(segment);
        }
        segment.columns.push(column);
      }
      column.days[d] = day;
      // Label a month on the column holding its 1st.
      if (day.endsWith("-01")) column.label = monthLabel(day);
    }
  }

  // Each segment's first column names its month too, unless a real label
  // follows within two columns and the two would overlap.
  for (const segment of segments) {
    const [first, second, third] = segment.columns;
    if (first && !first.label && !second?.label && !third?.label) {
      first.label = monthLabel(first.days.find(Boolean)!);
    }
  }

  return segments;
}

/**
 * The same grid for the vertical view, newest first: segments in reverse, and
 * each segment's weeks in reverse. Days within a week keep their order, since
 * a week reads left to right. Month labels stay on the week holding the 1st.
 */
export function newestFirst(segments: Segment[]): Segment[] {
  return [...segments].reverse().map((s) => ({ ...s, columns: [...s.columns].reverse() }));
}

/**
 * Month labels for the vertical view. Reading top-down (newest first), a month
 * starts at its *newest* week, so each week is labelled when its latest day
 * falls in a different month from the week above it. The first row always is.
 */
export function verticalMonthLabels(weeks: Column[]): (string | undefined)[] {
  let previous: string | null = null;
  return weeks.map((week) => {
    const latest = [...week.days].reverse().find(Boolean);
    if (!latest) return undefined;
    const month = latest.slice(0, 7);
    const label = month !== previous ? monthLabel(latest) : undefined;
    previous = month;
    return label;
  });
}
