"use client";

import { useState, useTransition } from "react";
import { CopyIcon, EyeIcon, PencilLineIcon } from "lucide-react";
import { toast } from "sonner";
import { disableViewLink, resetViewLink } from "@/app/w/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Workspace } from "@/lib/types";

type Props = {
  open: boolean;
  workspace: Workspace;
  onClose: () => void;
  onWorkspaceChange: (w: Workspace) => void;
};

export function ShareDialog({ open, workspace, onClose, onWorkspaceChange }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmReset, setConfirmReset] = useState(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const editUrl = `${origin}/w/${workspace.slug}`;
  const viewUrl = workspace.viewToken ? `${origin}/v/${workspace.viewToken}` : null;

  function run(action: typeof resetViewLink, done: string) {
    startTransition(async () => {
      const res = await action(workspace.slug);
      if (!res.ok) return void toast.error(res.error);
      onWorkspaceChange(res.data);
      setConfirmReset(false);
      toast.success(done);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>Two links: one to log with, one to look.</DialogDescription>
        </DialogHeader>

        <section className="space-y-2 rounded-xl bg-accent/60 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <PencilLineIcon className="size-4" /> Edit link
          </h3>
          <p className="text-xs text-muted-foreground">
            For people who log. They can add, change and delete anything
            {workspace.hasPin ? ", after entering your PIN." : ". Add a PIN in settings to lock it."}
          </p>
          <LinkRow url={editUrl} />
        </section>

        <section className="space-y-2 rounded-xl bg-accent/60 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <EyeIcon className="size-4" /> View-only link
          </h3>
          <p className="text-xs text-muted-foreground">
            For a teacher, coach or doctor. They see the grid, the entries and the stats, and can’t change
            anything. No PIN needed, and it doesn’t reveal the edit link.
          </p>
          {viewUrl ? (
            <>
              <LinkRow url={viewUrl} />
              <div className="flex flex-wrap gap-2 pt-1">
                {confirmReset ? (
                  <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(resetViewLink, "New view link created")}>
                    Replace it — the old link stops working
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmReset(true)}>
                    Reset link
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(disableViewLink, "View link turned off")}>
                  Turn off
                </Button>
              </div>
            </>
          ) : (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(resetViewLink, "View link created")}>
              Create view-only link
            </Button>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function LinkRow({ url }: { url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast(url);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md bg-popover px-2.5 py-1.5 text-xs">{url}</code>
      <Button size="sm" variant="secondary" onClick={copy}>
        <CopyIcon /> Copy
      </Button>
    </div>
  );
}
