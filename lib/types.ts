import type { Divider } from "./grid";
import type { IsoDay } from "./dates";

export type WorkspaceSettings = {
  divider: Divider;
  /** 0 = weeks start Sunday, 1 = Monday */
  weekStart: 0 | 1;
  /**
   * First day on the board. Entries before it are archived: kept in the database,
   * hidden from the grid and stats. Null on boards from before this setting existed,
   * which show all their history.
   */
  startDate: IsoDay | null;
  /** Name every weekday beside the horizontal grid; off hides the labels. */
  weekdayLabels: boolean;
  /** Print the day of the month in each cell's corner. */
  dayNumbers: boolean;
};

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  divider: "none",
  weekStart: 1,
  startDate: null,
  weekdayLabels: true,
  dayNumbers: false,
};

/**
 * What the client is allowed to see about a workspace. Never includes the PIN
 * hash. On the read-only view (/v/…) `slug` and `viewToken` are blanked, so
 * the edit link never reaches someone who was only given the view link.
 */
export type Workspace = {
  slug: string;
  name: string;
  hasPin: boolean;
  /** Secret for the read-only link, or null when it's turned off. */
  viewToken: string | null;
  settings: WorkspaceSettings;
  createdAt: string;
};

export type Person = {
  id: string;
  name: string;
  sortOrder: number;
};

export type Category = {
  id: string;
  name: string;
  color: string;
  unit: string | null;
  sortOrder: number;
};

export type Entry = {
  id: string;
  categoryId: string;
  day: IsoDay;
  description: string;
  quantity: number | null;
  /** Longer free-form context; empty when none. */
  notes: string;
  /** Who logged it; null when not attributed. */
  personId: string | null;
  /** The video or page it was done to, if any. */
  linkId: string | null;
  createdAt: string;
};

/** A web link attached to entries, with a preview. Together they're the library. */
export type Link = {
  id: string;
  url: string;
  kind: "video" | "page";
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};
