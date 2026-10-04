"use client";

import { useState, useTransition } from "react";
import { ArchiveIcon, LockIcon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { setPin, updateSettings } from "@/app/w/[slug]/actions";
import { Avatar } from "@/components/Avatar";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Divider } from "@/lib/grid";
import { longDayLabel, type IsoDay } from "@/lib/dates";
import { archivedCount, newlyArchivedCount } from "@/lib/startDate";
import type { Category, Entry, Person, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  workspace: Workspace;
  categories: Category[];
  people: Person[];
  /** Every entry, archived or not: the warning needs to know what a new date would hide. */
  entries: Entry[];
  onClose: () => void;
  onWorkspaceChange: (w: Workspace) => void;
  onEditCategory: (c: Category | null) => void;
  onEditPerson: (p: Person | null) => void;
};

export function SettingsDialog({
  open,
  workspace,
  categories,
  people,
  entries,
  onClose,
  onWorkspaceChange,
  onEditCategory,
  onEditPerson,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(workspace.name);
  const [pinDraft, setPinDraft] = useState("");
  const [editingPin, setEditingPin] = useState(false);

  const { startDate } = workspace.settings;
  const [startDraft, setStartDraft] = useState<IsoDay | "">(startDate ?? "");
  const startChanged = startDraft !== "" && startDraft !== startDate;
  const hiding = startChanged ? newlyArchivedCount(entries, startDate, startDraft) : 0;
  const archived = archivedCount(entries, startDate);

  function save(patch: { name?: string; divider?: Divider; weekStart?: 0 | 1; startDate?: IsoDay }) {
    // Apply immediately; roll back if the server refuses.
    const previous = workspace;
    onWorkspaceChange({
      ...workspace,
      name: patch.name ?? workspace.name,
      settings: {
        divider: patch.divider ?? workspace.settings.divider,
        weekStart: patch.weekStart ?? workspace.settings.weekStart,
        startDate: patch.startDate ?? workspace.settings.startDate,
      },
    });
    startTransition(async () => {
      const res = await updateSettings(workspace.slug, patch);
      if (!res.ok) {
        onWorkspaceChange(previous);
        if (patch.startDate) setStartDraft(previous.settings.startDate ?? "");
        toast.error(res.error);
      }
    });
  }

  function savePin(pin: string | null) {
    startTransition(async () => {
      const res = await setPin(workspace.slug, pin);
      if (!res.ok) return void toast.error(res.error);
      onWorkspaceChange(res.data);
      setPinDraft("");
      setEditingPin(false);
      toast.success(pin ? "PIN set" : "PIN removed");
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Changes apply for everyone with the link.</DialogDescription>
        </DialogHeader>

        <section className="space-y-1.5">
          <Label htmlFor="ws-name">Name</Label>
          <Input
            id="ws-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name.trim() !== workspace.name && save({ name: name.trim() })}
          />
        </section>

        <section className="space-y-2">
          <Label htmlFor="ws-start">Board starts on</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="ws-start"
              type="date"
              min="2000-01-01"
              value={startDraft}
              className="w-40"
              onChange={(e) => setStartDraft(e.target.value)}
            />
            {startChanged && hiding === 0 && (
              <Button variant="secondary" disabled={pending} onClick={() => save({ startDate: startDraft })}>
                Apply
              </Button>
            )}
          </div>
          {startChanged && hiding > 0 && (
            <div role="alert" className="space-y-2 rounded-lg bg-well p-3 text-sm">
              <p className="flex items-start gap-2">
                <ArchiveIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {hiding} {hiding === 1 ? "entry" : "entries"} before {longDayLabel(startDraft)} will no longer be
                  visible on the board or in stats. They stay saved as archived, and come back if you move the date
                  earlier.
                </span>
              </p>
              <div className="flex gap-2">
                <Button size="sm" disabled={pending} onClick={() => save({ startDate: startDraft })}>
                  Archive {hiding}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setStartDraft(startDate ?? "")}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {startDate
              ? archived > 0
                ? `${archived} archived ${archived === 1 ? "entry is" : "entries are"} hidden, not deleted.`
                : "The grid and stats count from this day."
              : "No start date yet: the board shows all history. Pick one to count from a set day."}
          </p>
        </section>

        <section className="space-y-1.5">
          <Label>Dividers</Label>
          <Segmented
            value={workspace.settings.divider}
            options={[
              { value: "none", label: "None" },
              { value: "month", label: "Months" },
              { value: "year", label: "Years" },
            ]}
            onChange={(divider) => save({ divider })}
          />
        </section>

        <section className="space-y-1.5">
          <Label>Weeks start on</Label>
          <Segmented
            value={workspace.settings.weekStart}
            options={[
              { value: 1, label: "Monday" },
              { value: 0, label: "Sunday" },
            ]}
            onChange={(weekStart) => save({ weekStart })}
          />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Categories</Label>
            <Button variant="ghost" size="xs" onClick={() => onEditCategory(null)}>
              <PlusIcon /> Add
            </Button>
          </div>
          <ul className="space-y-1">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5 rounded-lg bg-well py-1.5 pl-3 pr-1.5 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                <span className="flex-1 truncate">{c.name}</span>
                {c.unit && <span className="text-xs text-muted-foreground">{c.unit}</span>}
                <Hint label={`Edit ${c.name}`} side="left">
                  <Button variant="ghost" size="icon-xs" aria-label={`Edit ${c.name}`} onClick={() => onEditCategory(c)}>
                    <PencilIcon />
                  </Button>
                </Hint>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>People</Label>
            <Button variant="ghost" size="xs" onClick={() => onEditPerson(null)}>
              <PlusIcon /> Add
            </Button>
          </div>
          {people.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sharing with others? Add people so each entry shows who logged it.
            </p>
          ) : (
            <ul className="space-y-1">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5 rounded-lg bg-well py-1 pl-1.5 pr-1.5 text-sm">
                  <Avatar person={p} size="sm" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <Hint label={`Edit ${p.name}`} side="left">
                    <Button variant="ghost" size="icon-xs" aria-label={`Edit ${p.name}`} onClick={() => onEditPerson(p)}>
                      <PencilIcon />
                    </Button>
                  </Hint>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <LockIcon className="size-3.5" /> Passcode
          </Label>
          <p className="text-xs text-muted-foreground">
            {workspace.hasPin
              ? "Anyone opening the link needs the 4-digit PIN."
              : "Anyone with the link can view and edit. Add a 4-digit PIN to lock it."}
          </p>
          {editingPin || !workspace.hasPin ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (/^\d{4}$/.test(pinDraft)) savePin(pinDraft);
              }}
            >
              <Input
                inputMode="numeric"
                autoComplete="off"
                pattern="\d{4}"
                maxLength={4}
                placeholder="••••"
                className="w-24 text-center tracking-[0.4em]"
                value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              <Button type="submit" variant="secondary" disabled={pending || pinDraft.length !== 4}>
                {workspace.hasPin ? "Change PIN" : "Set PIN"}
              </Button>
            </form>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditingPin(true)}>
                Change PIN
              </Button>
              <Button variant="ghost" size="sm" onClick={() => savePin(null)} disabled={pending}>
                Remove PIN
              </Button>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" className="inline-flex rounded-lg bg-well p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => value !== o.value && onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value && "bg-popover text-foreground shadow-sm dark:bg-input",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
