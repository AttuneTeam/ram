import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkspaceApp } from "@/components/WorkspaceApp";
import { findWorkspaceByViewToken, loadWorkspaceData, toReadOnlyWorkspace } from "@/lib/workspace";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const row = await findWorkspaceByViewToken(token);
  return { title: row ? `${row.name} · Ram` : "Ram" };
}

/**
 * Read-only view of a workspace. The view token is its own secret: it skips
 * the PIN (which guards editing) and never exposes the edit slug. The page
 * renders no editing UI, and every server action requires the edit slug anyway.
 */
export default async function ViewPage({ params }: Props) {
  const { token } = await params;
  const row = await findWorkspaceByViewToken(token);
  if (!row) notFound();

  const { categories, people, entries } = await loadWorkspaceData(row.id);
  return (
    <WorkspaceApp
      workspace={toReadOnlyWorkspace(row)}
      categories={categories}
      people={people}
      entries={entries}
      readOnly
    />
  );
}
