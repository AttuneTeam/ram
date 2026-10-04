import { addDays, type IsoDay } from "./dates";
import type { Entry } from "./types";

/** New boards start a year back, so they open looking like a full year. */
export function defaultStartDate(today: IsoDay): IsoDay {
  return addDays(today, -365);
}

/** Entries on or after the start date. With no start date, everything. */
export function activeEntries(entries: Entry[], startDate: IsoDay | null): Entry[] {
  return startDate ? entries.filter((e) => e.day >= startDate) : entries;
}

/** How many entries fall before `startDate`: still stored, but off the board. */
export function archivedCount(entries: Entry[], startDate: IsoDay | null): number {
  return startDate ? entries.reduce((n, e) => n + (e.day < startDate ? 1 : 0), 0) : 0;
}

/** How many entries a move from `from` to `to` newly hides (0 when moving earlier). */
export function newlyArchivedCount(entries: Entry[], from: IsoDay | null, to: IsoDay): number {
  return entries.reduce((n, e) => n + (e.day < to && (!from || e.day >= from) ? 1 : 0), 0);
}
