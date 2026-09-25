import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PinGate } from "@/components/PinGate";
import { WorkspaceApp } from "@/components/WorkspaceApp";
import { findWorkspaceRow, hasAccess, loadWorkspaceData, toWorkspace } from "@/lib/workspace";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ new?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await findWorkspaceRow(slug);
  // Don't leak a locked workspace's name through the tab title or link previews.
  if (!row || !(await hasAccess(row))) return { title: "Ram" };
  return { title: `${row.name} · Ram` };
}

export default async function WorkspacePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const row = await findWorkspaceRow(slug);
  if (!row) notFound();
  if (!(await hasAccess(row))) return <PinGate slug={slug} />;

  const [{ categories, entries }, { new: isNew }] = await Promise.all([
    loadWorkspaceData(row.id),
    searchParams,
  ]);

  return (
    <WorkspaceApp
      workspace={toWorkspace(row)}
      categories={categories}
      entries={entries}
      isNew={isNew === "1"}
    />
  );
}
