import type { Divider } from "./grid";
import type { IsoDay } from "./dates";

export type WorkspaceSettings = {
  divider: Divider;
  /** 0 = weeks start Sunday, 1 = Monday */
  weekStart: 0 | 1;
};

export const DEFAULT_SETTINGS: WorkspaceSettings = { divider: "none", weekStart: 1 };

/** What the client is allowed to see about a workspace. Never includes the PIN hash. */
export type Workspace = {
  slug: string;
  name: string;
  hasPin: boolean;
  settings: WorkspaceSettings;
  createdAt: string;
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
  createdAt: string;
};
