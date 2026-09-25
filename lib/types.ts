import type { Divider } from "./grid";
import type { IsoDay } from "./dates";

export type WorkspaceSettings = {
  divider: Divider;
  /** 0 = weeks start Sunday, 1 = Monday */
  weekStart: 0 | 1;
};

export const DEFAULT_SETTINGS: WorkspaceSettings = { divider: "none", weekStart: 1 };

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
  /** Who logged it; null when not attributed. */
  personId: string | null;
  createdAt: string;
};
