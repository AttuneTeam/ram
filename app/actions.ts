"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const db = createAdminClient();

  // A slug collision at 82 bits is practically impossible, but retry rather than 500.
  let slug = "";
  let workspaceId = "";
  for (let attempt = 0; attempt < 3 && !workspaceId; attempt++) {
    slug = generateSlug();
    const { data, error } = await db
      .from("workspaces")
      .insert({ slug, name: parsed.data.name, pin_hash: pinHash, settings: DEFAULT_SETTINGS })
      .select("id")
      .single();
    if (!error) workspaceId = data.id;
    else if (error.code !== "23505") return { error: "Couldn't create the workspace. Try again." };
  }
  if (!workspaceId) return { error: "Couldn't create the workspace. Try again." };

  await db.from("categories").insert(
    STARTER_CATEGORIES.map((c, i) => ({ ...c, workspace_id: workspaceId, sort_order: i })),
  );

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
