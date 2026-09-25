"use server";

import { cookies } from "next/headers";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LOCK_MINUTES,
  MAX_PIN_ATTEMPTS,
  accessCookieName,
  accessToken,
  hashPin,
  isValidPin,
  verifyPin,
} from "@/lib/security";
import {
  AccessError,
  cookieSecret,
  findWorkspaceRow,
  requireWorkspace,
  toCategory,
  toEntry,
  toWorkspace,
} from "@/lib/workspace";
import { categoryInput, entryInput, settingsInput } from "@/lib/validation";
import { DEFAULT_SETTINGS, type Category, type Entry, type Workspace } from "@/lib/types";

/**
 * Actions return errors as values: Next.js masks thrown errors in production,
 * and the UI needs the message to show a useful toast.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof AccessError) return { ok: false, error: "This workspace is locked. Reload and enter the PIN." };
    if (err instanceof UserError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

class UserError extends Error {}

function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new UserError(result.error.issues[0].message);
  return result.data;
}

async function setAccessCookie(slug: string, pinHash: string) {
  (await cookies()).set(accessCookieName(slug), accessToken(slug, pinHash, cookieSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

// ── PIN ────────────────────────────────────────────────────────────────────

export async function unlockWorkspace(slug: string, pin: string): Promise<Result<null>> {
  const row = await findWorkspaceRow(slug);
  if (!row || !row.pin_hash) return { ok: false, error: "Workspace not found" };

  if (row.pin_locked_until && new Date(row.pin_locked_until) > new Date()) {
    const mins = Math.ceil((new Date(row.pin_locked_until).getTime() - Date.now()) / 60_000);
    return { ok: false, error: `Too many attempts. Try again in ${mins} min.` };
  }

  const db = createAdminClient();
  if (!isValidPin(pin) || !verifyPin(pin, row.pin_hash)) {
    const attempts = row.failed_pin_attempts + 1;
    const locked = attempts >= MAX_PIN_ATTEMPTS;
    await db
      .from("workspaces")
      .update({
        failed_pin_attempts: locked ? 0 : attempts,
        pin_locked_until: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
      })
      .eq("id", row.id);
    return {
      ok: false,
      error: locked
        ? `Too many attempts. Locked for ${LOCK_MINUTES} min.`
        : `Wrong PIN. ${MAX_PIN_ATTEMPTS - attempts} attempt${MAX_PIN_ATTEMPTS - attempts === 1 ? "" : "s"} left.`,
    };
  }

  await db
    .from("workspaces")
    .update({ failed_pin_attempts: 0, pin_locked_until: null })
    .eq("id", row.id);
  await setAccessCookie(row.slug, row.pin_hash);
  return { ok: true, data: null };
}

/** Set, change or (with null) remove the PIN. */
export async function setPin(slug: string, pin: string | null): Promise<Result<Workspace>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    if (pin !== null && !isValidPin(pin)) throw new UserError("PIN must be 4 digits");
    const pinHash = pin === null ? null : hashPin(pin);
    const { data, error } = await createAdminClient()
      .from("workspaces")
      .update({ pin_hash: pinHash, failed_pin_attempts: 0, pin_locked_until: null })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw error;
    if (pinHash) await setAccessCookie(row.slug, pinHash);
    else (await cookies()).delete(accessCookieName(row.slug));
    return toWorkspace(data);
  });
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function updateSettings(
  slug: string,
  input: { name?: string; divider?: string; weekStart?: number },
): Promise<Result<Workspace>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const { name, ...settings } = parse(settingsInput, input);
    const { data, error } = await createAdminClient()
      .from("workspaces")
      .update({
        ...(name ? { name } : {}),
        settings: { ...DEFAULT_SETTINGS, ...(row.settings ?? {}), ...settings },
      })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw error;
    return toWorkspace(data);
  });
}

// ── Categories ─────────────────────────────────────────────────────────────

function categoryError(error: { code?: string }): never {
  if (error.code === "23505") throw new UserError("You already have a category with that name");
  throw error;
}

export async function createCategory(
  slug: string,
  input: { name: string; color: string; unit?: string | null },
): Promise<Result<Category>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const values = parse(categoryInput, input);
    const db = createAdminClient();
    const { count } = await db
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", row.id);
    if ((count ?? 0) >= 50) throw new UserError("That's a lot of categories — 50 is the limit");
    const { data, error } = await db
      .from("categories")
      .insert({ ...values, unit: values.unit ?? null, workspace_id: row.id, sort_order: count ?? 0 })
      .select("id, name, color, unit, sort_order")
      .single();
    if (error) categoryError(error);
    return toCategory(data);
  });
}

export async function updateCategory(
  slug: string,
  id: string,
  input: { name: string; color: string; unit?: string | null },
): Promise<Result<Category>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const values = parse(categoryInput, input);
    const { data, error } = await createAdminClient()
      .from("categories")
      .update({ ...values, unit: values.unit ?? null })
      .eq("id", id)
      .eq("workspace_id", row.id)
      .select("id, name, color, unit, sort_order")
      .single();
    if (error) categoryError(error);
    return toCategory(data);
  });
}

/** Deletes the category and every entry logged under it. */
export async function deleteCategory(slug: string, id: string): Promise<Result<null>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const { error } = await createAdminClient()
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("workspace_id", row.id);
    if (error) throw error;
    return null;
  });
}

// ── Entries ────────────────────────────────────────────────────────────────

type EntryFields = {
  categoryId: string;
  day: string;
  description?: string;
  quantity?: number | null;
};

function entryValues(input: EntryFields) {
  const v = parse(entryInput, input);
  return { category_id: v.categoryId, day: v.day, description: v.description, quantity: v.quantity };
}

const ENTRY_COLUMNS = "id, category_id, day, description, quantity, created_at";

export async function createEntry(slug: string, input: EntryFields): Promise<Result<Entry>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    // The composite FK rejects a category from another workspace.
    const { data, error } = await createAdminClient()
      .from("entries")
      .insert({ ...entryValues(input), workspace_id: row.id })
      .select(ENTRY_COLUMNS)
      .single();
    if (error) {
      if (error.code === "23503") throw new UserError("That category no longer exists");
      throw error;
    }
    return toEntry(data);
  });
}

export async function updateEntry(slug: string, id: string, input: EntryFields): Promise<Result<Entry>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const { data, error } = await createAdminClient()
      .from("entries")
      .update(entryValues(input))
      .eq("id", id)
      .eq("workspace_id", row.id)
      .select(ENTRY_COLUMNS)
      .single();
    if (error) throw error;
    return toEntry(data);
  });
}

export async function deleteEntry(slug: string, id: string): Promise<Result<null>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const { error } = await createAdminClient()
      .from("entries")
      .delete()
      .eq("id", id)
      .eq("workspace_id", row.id);
    if (error) throw error;
    return null;
  });
}
