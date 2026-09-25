"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, pgCode, UNIQUE_VIOLATION } from "@/lib/db";
import { accessCookieName, accessToken, generateSlug, hashPin } from "@/lib/security";
import { cookieSecret } from "@/lib/workspace";
import { workspaceInput } from "@/lib/validation";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { STARTER_CATEGORIES } from "@/lib/palette";

export type CreateState = { error?: string };

export async function createWorkspace(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const parsed = workspaceInput.safeParse({
    name: formData.get("name"),
    pin: formData.get("pin") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const pinHash = parsed.data.pin ? hashPin(parsed.data.pin) : null;
  const sql = db();

  // A slug collision at 82 bits is practically impossible, but retry rather than 500.
  let slug: string | null = null;
  for (let attempt = 0; attempt < 3 && !slug; attempt++) {
    const candidate = generateSlug();
    try {
      await sql.begin(async (tx) => {
        const [{ id }] = await tx<{ id: string }[]>`
          insert into workspaces (slug, name, pin_hash, settings)
          values (${candidate}, ${parsed.data.name}, ${pinHash}, ${tx.json(DEFAULT_SETTINGS)})
          returning id`;
        const starters = STARTER_CATEGORIES.map((c, i) => ({ ...c, workspace_id: id, sort_order: i }));
        await tx`insert into categories ${tx(starters, "workspace_id", "name", "color", "unit", "sort_order")}`;
      });
      slug = candidate;
    } catch (err) {
      if (pgCode(err) !== UNIQUE_VIOLATION) {
        console.error(err);
        return { error: "Couldn't create the workspace. Try again." };
      }
    }
  }
  if (!slug) return { error: "Couldn't create the workspace. Try again." };

  // The creator just chose the PIN, so don't make them type it again.
  if (pinHash) {
    (await cookies()).set(accessCookieName(slug), accessToken(slug, pinHash, cookieSecret()), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  redirect(`/w/${slug}?new=1`);
}
