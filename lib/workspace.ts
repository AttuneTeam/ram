import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { accessCookieName, verifyAccessToken } from "./security";
import {
  DEFAULT_SETTINGS,
  type Category,
  type Entry,
  type Person,
  type Workspace,
  type WorkspaceSettings,
} from "./types";

export type WorkspaceRow = {
  id: string;
  slug: string;
  name: string;
  pin_hash: string | null;
  view_token: string | null;
  failed_pin_attempts: number;
  pin_locked_until: Date | null;
  settings: Partial<WorkspaceSettings> | null;
  created_at: Date;
};

export type CategoryRow = {
  id: string;
  name: string;
  color: string;
  unit: string | null;
  sort_order: number;
};

export type PersonRow = {
  id: string;
  name: string;
  sort_order: number;
};

export type EntryRow = {
  id: string;
  category_id: string;
  person_id: string | null;
  day: string;
  description: string;
  quantity: string | null;
  created_at: Date;
};

export const CATEGORY_COLUMNS = ["id", "name", "color", "unit", "sort_order"] as const;
export const PERSON_COLUMNS = ["id", "name", "sort_order"] as const;
export const ENTRY_COLUMNS = ["id", "category_id", "person_id", "day", "description", "quantity", "created_at"] as const;

export function cookieSecret(): string {
  const secret = process.env.ACCESS_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ACCESS_COOKIE_SECRET must be set (32+ chars)");
  }
  return secret;
}

export function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    slug: row.slug,
    name: row.name,
    hasPin: row.pin_hash !== null,
    viewToken: row.view_token,
    settings: { ...DEFAULT_SETTINGS, ...(row.settings ?? {}) },
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * The same workspace for the read-only view. The edit slug and the view token
 * are blanked: someone holding only the view link must never learn the edit link.
 */
export function toReadOnlyWorkspace(row: WorkspaceRow): Workspace {
  return { ...toWorkspace(row), slug: "", viewToken: null, hasPin: false };
}

export function toPerson(row: PersonRow): Person {
  return { id: row.id, name: row.name, sortOrder: row.sort_order };
}

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    unit: row.unit,
    sortOrder: row.sort_order,
  };
}

export function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    categoryId: row.category_id,
    personId: row.person_id,
    day: row.day,
    description: row.description,
    // Postgres numeric arrives as a string to avoid precision loss.
    quantity: row.quantity === null ? null : Number(row.quantity),
    createdAt: row.created_at.toISOString(),
  };
}

export async function findWorkspaceRow(slug: string): Promise<WorkspaceRow | null> {
  if (!/^[A-Za-z0-9]{10,32}$/.test(slug)) return null;
  const [row] = await db()<WorkspaceRow[]>`select * from workspaces where slug = ${slug}`;
  return row ?? null;
}

/** Looks up a workspace by its read-only link. Grants viewing only. */
export async function findWorkspaceByViewToken(token: string): Promise<WorkspaceRow | null> {
  if (!/^[A-Za-z0-9]{16,40}$/.test(token)) return null;
  const [row] = await db()<WorkspaceRow[]>`select * from workspaces where view_token = ${token}`;
  return row ?? null;
}

export async function hasAccess(row: WorkspaceRow): Promise<boolean> {
  if (!row.pin_hash) return true;
  const token = (await cookies()).get(accessCookieName(row.slug))?.value;
  return verifyAccessToken(token, row.slug, row.pin_hash, cookieSecret());
}

export class AccessError extends Error {}

/** The gate every server action passes through. */
export async function requireWorkspace(slug: string): Promise<WorkspaceRow> {
  const row = await findWorkspaceRow(slug);
  if (!row || !(await hasAccess(row))) throw new AccessError("Workspace not found or locked");
  return row;
}

export async function loadWorkspaceData(workspaceId: string) {
  const sql = db();
  const [categories, people, entries] = await Promise.all([
    sql<CategoryRow[]>`
      select ${sql(CATEGORY_COLUMNS)} from categories
      where workspace_id = ${workspaceId}
      order by sort_order, created_at`,
    sql<PersonRow[]>`
      select ${sql(PERSON_COLUMNS)} from people
      where workspace_id = ${workspaceId}
      order by sort_order, created_at`,
    sql<EntryRow[]>`
      select ${sql(ENTRY_COLUMNS)} from entries
      where workspace_id = ${workspaceId}
      order by day, created_at`,
  ]);
  return {
    categories: categories.map(toCategory),
    people: people.map(toPerson),
    entries: entries.map(toEntry),
  };
}
