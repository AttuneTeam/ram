import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "./supabase/admin";
import { accessCookieName, verifyAccessToken } from "./security";
import { DEFAULT_SETTINGS, type Category, type Entry, type Workspace, type WorkspaceSettings } from "./types";

export type WorkspaceRow = {
  id: string;
  slug: string;
  name: string;
  pin_hash: string | null;
  failed_pin_attempts: number;
  pin_locked_until: string | null;
  settings: Partial<WorkspaceSettings> | null;
  created_at: string;
};

type CategoryRow = {
  id: string;
  name: string;
  color: string;
  unit: string | null;
  sort_order: number;
};

type EntryRow = {
  id: string;
  category_id: string;
  day: string;
  description: string;
  quantity: number | string | null;
  created_at: string;
};

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
    settings: { ...DEFAULT_SETTINGS, ...(row.settings ?? {}) },
    createdAt: row.created_at,
  };
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
    day: row.day,
    description: row.description,
    // Postgres numeric arrives as a string.
    quantity: row.quantity === null ? null : Number(row.quantity),
    createdAt: row.created_at,
  };
}

export async function findWorkspaceRow(slug: string): Promise<WorkspaceRow | null> {
  if (!/^[A-Za-z0-9]{10,32}$/.test(slug)) return null;
  const { data, error } = await createAdminClient()
    .from("workspaces")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as WorkspaceRow | null;
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

const PAGE = 1000;

export async function loadWorkspaceData(workspaceId: string) {
  const db = createAdminClient();
  const { data: categories, error } = await db
    .from("categories")
    .select("id, name, color, unit, sort_order")
    .eq("workspace_id", workspaceId)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;

  // PostgREST caps each response (1000 rows by default), so page through.
  const entries: EntryRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error: entriesError } = await db
      .from("entries")
      .select("id, category_id, day, description, quantity, created_at")
      .eq("workspace_id", workspaceId)
      .order("day")
      .order("created_at")
      .range(from, from + PAGE - 1);
    if (entriesError) throw entriesError;
    entries.push(...(data as EntryRow[]));
    if (data.length < PAGE) break;
  }

  return {
    categories: (categories as CategoryRow[]).map(toCategory),
    entries: entries.map(toEntry),
  };
}
