"use server";

import { cookies } from "next/headers";
import type { z } from "zod";
import { formatDay } from "@/lib/dates";
import { db, FOREIGN_KEY_VIOLATION, pgCode, UNIQUE_VIOLATION } from "@/lib/db";
import {
  LOCK_MINUTES,
  MAX_PIN_ATTEMPTS,
  accessCookieName,
  accessToken,
  generateSlug,
  hashPin,
  isValidPin,
  verifyPin,
} from "@/lib/security";
import {
  AccessError,
  CATEGORY_COLUMNS,
  ENTRY_COLUMNS,
  LINK_COLUMNS,
  PERSON_COLUMNS,
  cookieSecret,
  findWorkspaceRow,
  requireWorkspace,
  toCategory,
  toEntry,
  toLink,
  toPerson,
  toWorkspace,
  type CategoryRow,
  type EntryRow,
  type LinkRow,
  type PersonRow,
  type WorkspaceRow,
} from "@/lib/workspace";
import { normalizeUrl } from "@/lib/links";
import { fetchLinkMeta } from "@/lib/linkPreview";
import { categoryInput, entryInput, personInput, settingsInput } from "@/lib/validation";
import {
  DEFAULT_SETTINGS,
  type Category,
  type Entry,
  type Link,
  type Person,
  type Workspace,
} from "@/lib/types";

/**
 * Actions return errors as values: Next.js masks thrown errors in production,
 * and the UI needs the message to show a useful toast.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

class UserError extends Error {}

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

function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new UserError(result.error.issues[0].message);
  return result.data;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function checkId(id: string): string {
  if (!UUID.test(id)) throw new UserError("Not found");
  return id;
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

  const lockedMessage = (until: Date) =>
    `Too many attempts. Try again in ${Math.ceil((until.getTime() - Date.now()) / 60_000)} min.`;

  if (row.pin_locked_until && row.pin_locked_until > new Date()) {
    return { ok: false, error: lockedMessage(row.pin_locked_until) };
  }

  const sql = db();
  if (!isValidPin(pin) || !verifyPin(pin, row.pin_hash)) {
    // One atomic statement, so parallel guesses can't all read the same count.
    const [updated] = await sql<{ failed_pin_attempts: number; pin_locked_until: Date | null }[]>`
      update workspaces set
        failed_pin_attempts = case when failed_pin_attempts + 1 >= ${MAX_PIN_ATTEMPTS} then 0 else failed_pin_attempts + 1 end,
        pin_locked_until = case when failed_pin_attempts + 1 >= ${MAX_PIN_ATTEMPTS}
          then now() + make_interval(mins => ${LOCK_MINUTES}) else pin_locked_until end
      where id = ${row.id}
      returning failed_pin_attempts, pin_locked_until`;
    if (updated.pin_locked_until && updated.pin_locked_until > new Date()) {
      return { ok: false, error: `Too many attempts. Locked for ${LOCK_MINUTES} min.` };
    }
    const left = MAX_PIN_ATTEMPTS - updated.failed_pin_attempts;
    return { ok: false, error: `Wrong PIN. ${left} attempt${left === 1 ? "" : "s"} left.` };
  }

  await sql`update workspaces set failed_pin_attempts = 0, pin_locked_until = null where id = ${row.id}`;
  await setAccessCookie(row.slug, row.pin_hash);
  return { ok: true, data: null };
}

/** Set, change or (with null) remove the PIN. */
export async function setPin(slug: string, pin: string | null): Promise<Result<Workspace>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    if (pin !== null && !isValidPin(pin)) throw new UserError("PIN must be 4 digits");
    const pinHash = pin === null ? null : hashPin(pin);
    const [updated] = await db()<WorkspaceRow[]>`
      update workspaces
      set pin_hash = ${pinHash}, failed_pin_attempts = 0, pin_locked_until = null
      where id = ${row.id}
      returning *`;
    if (pinHash) await setAccessCookie(row.slug, pinHash);
    else (await cookies()).delete(accessCookieName(row.slug));
    return toWorkspace(updated);
  });
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function updateSettings(
  slug: string,
  input: {
    name?: string;
    divider?: string;
    weekStart?: number;
    startDate?: string;
    weekdayLabels?: boolean;
    dayNumbers?: boolean;
  },
): Promise<Result<Workspace>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const { name, ...settings } = parse(settingsInput, input);
    if (settings.startDate && settings.startDate > formatDay(new Date(Date.now() + 86_400_000))) {
      throw new UserError("Start date can't be in the future");
    }
    const sql = db();
    const merged = { ...DEFAULT_SETTINGS, ...(row.settings ?? {}), ...settings };
    const [updated] = await sql<WorkspaceRow[]>`
      update workspaces
      set name = ${name ?? row.name}, settings = ${sql.json(merged)}
      where id = ${row.id}
      returning *`;
    return toWorkspace(updated);
  });
}

// ── View-only link ─────────────────────────────────────────────────────────

/**
 * Create the read-only link, or replace it (the old one stops working).
 * 20 chars ≈ 117 bits; longer than the edit slug so the two are never confused.
 */
export async function resetViewLink(slug: string): Promise<Result<Workspace>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const [updated] = await db()<WorkspaceRow[]>`
      update workspaces set view_token = ${generateSlug(20)}
      where id = ${row.id}
      returning *`;
    return toWorkspace(updated);
  });
}

export async function disableViewLink(slug: string): Promise<Result<Workspace>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const [updated] = await db()<WorkspaceRow[]>`
      update workspaces set view_token = null
      where id = ${row.id}
      returning *`;
    return toWorkspace(updated);
  });
}

// ── People ─────────────────────────────────────────────────────────────────

function rethrowPerson(err: unknown): never {
  if (pgCode(err) === UNIQUE_VIOLATION) throw new UserError("Someone with that name is already here");
  throw err;
}

export async function createPerson(slug: string, input: { name: string }): Promise<Result<Person>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const { name } = parse(personInput, input);
    const sql = db();
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from people where workspace_id = ${row.id}`;
    if (count >= 50) throw new UserError("50 people is the limit");
    const [created] = await sql<PersonRow[]>`
      insert into people (workspace_id, name, sort_order)
      values (${row.id}, ${name}, ${count})
      returning ${sql(PERSON_COLUMNS)}`.catch(rethrowPerson);
    return toPerson(created);
  });
}

export async function updatePerson(slug: string, id: string, input: { name: string }): Promise<Result<Person>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const { name } = parse(personInput, input);
    const sql = db();
    const [updated] = await sql<PersonRow[]>`
      update people set name = ${name}
      where id = ${checkId(id)}::uuid and workspace_id = ${row.id}
      returning ${sql(PERSON_COLUMNS)}`.catch(rethrowPerson);
    if (!updated) throw new UserError("That person no longer exists");
    return toPerson(updated);
  });
}

/** Removes the person. Their entries stay, just no longer attributed. */
export async function deletePerson(slug: string, id: string): Promise<Result<null>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    await db()`delete from people where id = ${checkId(id)}::uuid and workspace_id = ${row.id}`;
    return null;
  });
}

// ── Categories ─────────────────────────────────────────────────────────────

function rethrowCategory(err: unknown): never {
  if (pgCode(err) === UNIQUE_VIOLATION) throw new UserError("You already have a category with that name");
  throw err;
}

export async function createCategory(
  slug: string,
  input: { name: string; color: string; unit?: string | null },
): Promise<Result<Category>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const { name, color, unit } = parse(categoryInput, input);
    const sql = db();
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from categories where workspace_id = ${row.id}`;
    if (count >= 50) throw new UserError("That's a lot of categories — 50 is the limit");
    const [created] = await sql<CategoryRow[]>`
      insert into categories (workspace_id, name, color, unit, sort_order)
      values (${row.id}, ${name}, ${color}, ${unit ?? null}, ${count})
      returning ${sql(CATEGORY_COLUMNS)}`.catch(rethrowCategory);
    return toCategory(created);
  });
}

export async function updateCategory(
  slug: string,
  id: string,
  input: { name: string; color: string; unit?: string | null },
): Promise<Result<Category>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const { name, color, unit } = parse(categoryInput, input);
    const sql = db();
    const [updated] = await sql<CategoryRow[]>`
      update categories set name = ${name}, color = ${color}, unit = ${unit ?? null}
      where id = ${checkId(id)}::uuid and workspace_id = ${row.id}
      returning ${sql(CATEGORY_COLUMNS)}`.catch(rethrowCategory);
    if (!updated) throw new UserError("That category no longer exists");
    return toCategory(updated);
  });
}

/** Deletes the category and every entry logged under it. */
export async function deleteCategory(slug: string, id: string): Promise<Result<null>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    await db()`delete from categories where id = ${checkId(id)}::uuid and workspace_id = ${row.id}`;
    return null;
  });
}

// ── Links ──────────────────────────────────────────────────────────────────

/**
 * The workspace's link for this URL, creating it (and fetching its preview)
 * the first time it's seen. The server does the fetching, never the browser,
 * behind the checks in lib/linkPreview.ts.
 */
async function ensureLink(workspaceId: string, input: string): Promise<LinkRow> {
  const url = normalizeUrl(input);
  if (!url) throw new UserError("That doesn’t look like a web link");
  const sql = db();
  const [existing] = await sql<LinkRow[]>`
    select ${sql(LINK_COLUMNS)} from links where workspace_id = ${workspaceId} and url = ${url}`;
  // A preview that failed last time gets another go.
  if (existing?.title) return existing;

  if (!existing) {
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from links where workspace_id = ${workspaceId}`;
    if (count >= 5000) throw new UserError("Your library is full — 5,000 links is the limit");
  }
  const meta = await fetchLinkMeta(url);
  // Two tabs can save the same new link at once; the unique key makes that one row.
  const [link] = await sql<LinkRow[]>`
    insert into links (workspace_id, url, kind, title, description, image_url, site_name)
    values (${workspaceId}, ${url}, ${meta.kind}, ${meta.title}, ${meta.description}, ${meta.imageUrl}, ${meta.siteName})
    on conflict (workspace_id, url) do update set
      kind = excluded.kind,
      title = coalesce(excluded.title, links.title),
      description = coalesce(excluded.description, links.description),
      image_url = coalesce(excluded.image_url, links.image_url),
      site_name = coalesce(excluded.site_name, links.site_name)
    returning ${sql(LINK_COLUMNS)}`;
  return link;
}

/** Preview a link while it's being typed into the day dialog. */
export async function previewLink(slug: string, url: string): Promise<Result<Link>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    return toLink(await ensureLink(row.id, url));
  });
}

/** Removes a link from the library. Its entries stay, just without the link. */
export async function deleteLink(slug: string, id: string): Promise<Result<null>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    await db()`delete from links where id = ${checkId(id)}::uuid and workspace_id = ${row.id}`;
    return null;
  });
}

// ── Entries ────────────────────────────────────────────────────────────────

type EntryFields = {
  categoryId: string;
  personId?: string | null;
  day: string;
  description?: string;
  quantity?: number | null;
  url?: string | null;
};

/** Entries before the board's start date would be archived on arrival, so refuse them. */
function checkAfterStart(row: WorkspaceRow, day: string) {
  const { startDate } = { ...DEFAULT_SETTINGS, ...(row.settings ?? {}) };
  if (startDate && day < startDate) throw new UserError("That day is before the board's start date");
}

/** An entry plus its link, so the client can show the preview straight away. */
export type SavedEntry = { entry: Entry; link: Link | null };

function rethrowEntry(err: unknown): never {
  // Composite FKs: the category, person or link was deleted, or belongs to another workspace.
  if (pgCode(err) === FOREIGN_KEY_VIOLATION) throw new UserError("That category or person no longer exists");
  throw err;
}

export async function createEntry(slug: string, input: EntryFields): Promise<Result<SavedEntry>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const v = parse(entryInput, input);
    checkAfterStart(row, v.day);
    const link = v.url ? await ensureLink(row.id, v.url) : null;
    const sql = db();
    // The composite FKs reject a category, person or link from another workspace.
    const [created] = await sql<EntryRow[]>`
      insert into entries (workspace_id, category_id, person_id, link_id, day, description, quantity)
      values (${row.id}, ${v.categoryId}, ${v.personId}, ${link?.id ?? null}, ${v.day}, ${v.description}, ${v.quantity})
      returning ${sql(ENTRY_COLUMNS)}`.catch(rethrowEntry);
    return { entry: toEntry(created), link: link && toLink(link) };
  });
}

export async function updateEntry(slug: string, id: string, input: EntryFields): Promise<Result<SavedEntry>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    const v = parse(entryInput, input);
    checkAfterStart(row, v.day);
    const link = v.url ? await ensureLink(row.id, v.url) : null;
    const sql = db();
    const [updated] = await sql<EntryRow[]>`
      update entries set
        category_id = ${v.categoryId}, person_id = ${v.personId}, link_id = ${link?.id ?? null},
        day = ${v.day}, description = ${v.description}, quantity = ${v.quantity}
      where id = ${checkId(id)}::uuid and workspace_id = ${row.id}
      returning ${sql(ENTRY_COLUMNS)}`.catch(rethrowEntry);
    if (!updated) throw new UserError("That entry no longer exists");
    return { entry: toEntry(updated), link: link && toLink(link) };
  });
}

export async function deleteEntry(slug: string, id: string): Promise<Result<null>> {
  return run(async () => {
    const row = await requireWorkspace(slug);
    await db()`delete from entries where id = ${checkId(id)}::uuid and workspace_id = ${row.id}`;
    return null;
  });
}
