"use client";

import { useState, useTransition } from "react";
import { ArchiveIcon, LockIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteCategory, deletePerson, setPin, updateSettings } from "@/app/w/[slug]/actions";
import { Avatar } from "@/components/Avatar";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Divider } from "@/lib/grid";
import type { Orientation } from "@/lib/orientation";
import { longDayLabel, type IsoDay } from "@/lib/dates";
import { archivedCount, newlyArchivedCount } from "@/lib/startDate";
import type { Category, Entry, Person, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The horizontal/vertical layout switch is hidden for now. */
const SHOW_LAYOUT_OPTION = false;

type Props = {
  open: boolean;
  workspace: Workspace;
  categories: Category[];
  people: Person[];
  /** Every entry, archived or not: the warning needs to know what a new date would hide. */
  entries: Entry[];
  orientation: Orientation;
  onOrientationChange: (o: Orientation) => void;
  onClose: () => void;
  onWorkspaceChange: (w: Workspace) => void;
  onEditCategory: (c: Category | null) => void;
  onCategoryDeleted: (id: string) => void;
  onEditPerson: (p: Person | null) => void;
  onPersonDeleted: (id: string) => void;
};

export function SettingsSheet({
  open,
  workspace,
  categories,
  people,
  entries,
  orientation,
  onOrientationChange,
  onClose,
  onWorkspaceChange,
  onEditCategory,
  onCategoryDeleted,
  onEditPerson,
  onPersonDeleted,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(workspace.name);
  const [pinDraft, setPinDraft] = useState("");
  const [editingPin, setEditingPin] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  // Kept after closing so the dialog text doesn't blank while it fades out.
  const [lastDeleting, setLastDeleting] = useState<Category | null>(null);
  if (deleting && deleting !== lastDeleting) setLastDeleting(deleting);
  const [removing, setRemoving] = useState<Person | null>(null);
  const [lastRemoving, setLastRemoving] = useState<Person | null>(null);
  if (removing && removing !== lastRemoving) setLastRemoving(removing);

  const { startDate } = workspace.settings;
  const [startDraft, setStartDraft] = useState<IsoDay | "">(startDate ?? "");
  const startChanged = startDraft !== "" && startDraft !== startDate;
  const hiding = startChanged ? newlyArchivedCount(entries, startDate, startDraft) : 0;
  const archived = archivedCount(entries, startDate);

  function save(patch: {
    name?: string;
    divider?: Divider;
    weekStart?: 0 | 1;
    startDate?: IsoDay;
    weekdayLabels?: boolean;
    dayNumbers?: boolean;
  }) {
    // Apply immediately; roll back if the server refuses.
    const previous = workspace;
    onWorkspaceChange({
      ...workspace,
      name: patch.name ?? workspace.name,
      settings: {
        divider: patch.divider ?? workspace.settings.divider,
        weekStart: patch.weekStart ?? workspace.settings.weekStart,
        startDate: patch.startDate ?? workspace.settings.startDate,
        weekdayLabels: patch.weekdayLabels ?? workspace.settings.weekdayLabels,
        dayNumbers: patch.dayNumbers ?? workspace.settings.dayNumbers,
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

  function removeCategory() {
    if (!deleting) return;
    const category = deleting;
    startTransition(async () => {
      const res = await deleteCategory(workspace.slug, category.id);
      if (!res.ok) return void toast.error(res.error);
      setDeleting(null);
      onCategoryDeleted(category.id);
    });
  }

  function removePerson() {
    if (!removing) return;
    const person = removing;
    startTransition(async () => {
      const res = await deletePerson(workspace.slug, person.id);
      if (!res.ok) return void toast.error(res.error);
      setRemoving(null);
      onPersonDeleted(person.id);
    });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="data-[side=right]:w-full overflow-y-auto min-[480px]:max-w-md!">
        <SheetHeader className="pr-12">
          <SheetTitle className="text-lg tracking-tight">Settings</SheetTitle>
          <SheetDescription>Changes apply for everyone with the link.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">

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
          {!startChanged && (
            <p className="text-xs text-muted-foreground">
              {startDate
                ? archived > 0
                  ? `${archived} archived ${archived === 1 ? "entry is" : "entries are"} hidden, not deleted.`
                  : "The grid and stats count from this day."
                : "No start date yet: the board shows all history. Pick one to count from a set day."}
            </p>
          )}
        </section>

        <section className="space-y-1.5">
          <Label>Dividers</Label>
          <Segmented
            value={workspace.settings.divider}
            options={[
              { value: "none", label: "None", preview: <DividerPreview gaps={0} /> },
              { value: "month", label: "Months", preview: <DividerPreview gaps={2} outlined /> },
              { value: "year", label: "Years", preview: <DividerPreview gaps={5} /> },
            ]}
            onChange={(divider) => save({ divider })}
          />
        </section>

        <section className="space-y-1.5">
          <Label>Weeks start on</Label>
          <Segmented
            value={workspace.settings.weekStart}
            options={[
              { value: 1, label: "Monday", preview: <Tile>M</Tile> },
              { value: 0, label: "Sunday", preview: <Tile>S</Tile> },
            ]}
            onChange={(weekStart) => save({ weekStart })}
          />
        </section>

        <section className="space-y-1.5">
          <Label>Weekday labels</Label>
          <Segmented
            value={workspace.settings.weekdayLabels}
            options={[
              { value: true, label: "Show", preview: <WeekdayPreview labels /> },
              { value: false, label: "Hide", preview: <WeekdayPreview labels={false} /> },
            ]}
            onChange={(weekdayLabels) => save({ weekdayLabels })}
          />
        </section>

        <section className="space-y-1.5">
          <Label>Day numbers</Label>
          <Segmented
            value={workspace.settings.dayNumbers}
            options={[
              { value: false, label: "Hide", preview: <DayTile />, bare: true },
              { value: true, label: "Show", preview: <DayTile number="12" />, bare: true },
            ]}
            onChange={(dayNumbers) => save({ dayNumbers })}
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
                <Hint label={`Delete ${c.name}`} side="left">
                  <Button variant="ghost" size="icon-xs" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}>
                    <Trash2Icon />
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
                  <Hint label={`Remove ${p.name}`} side="left">
                    <Button variant="ghost" size="icon-xs" aria-label={`Remove ${p.name}`} onClick={() => setRemoving(p)}>
                      <Trash2Icon />
                    </Button>
                  </Hint>
                </li>
              ))}
            </ul>
          )}
        </section>

        {SHOW_LAYOUT_OPTION && (
          <section className="space-y-1.5">
            <Label>Layout</Label>
            <Segmented
              value={orientation}
              options={[
                { value: "horizontal", label: "Horizontal" },
                { value: "vertical", label: "Vertical" },
              ]}
              onChange={onOrientationChange}
            />
            {/* Unlike everything else here, this is a per-device preference (lib/orientation.ts). */}
            <p className="text-xs text-muted-foreground">Only on this device. Everyone else keeps their own.</p>
          </section>
        )}

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
        </div>
      </SheetContent>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && !pending && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete “{lastDeleting?.name}”?</DialogTitle>
            <DialogDescription>This also deletes every entry logged under it. This can’t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={pending}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={removeCategory} disabled={pending}>
              {pending ? "Deleting…" : "Delete category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removing !== null} onOpenChange={(o) => !o && !pending && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove {lastRemoving?.name}?</DialogTitle>
            <DialogDescription>Their entries stay on the grid, but will no longer show who logged them.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)} disabled={pending}>
              Keep them
            </Button>
            <Button variant="destructive" onClick={removePerson} disabled={pending}>
              {pending ? "Removing…" : "Remove person"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

function Segmented<T extends string | number | boolean>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; preview?: React.ReactNode; bare?: boolean }[];
  onChange: (v: T) => void;
}) {
  const selected = options.find((o) => o.value === value);
  const preview = selected?.preview;
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" className="inline-flex rounded-md bg-well p-0.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => value !== o.value && onChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === o.value && "bg-popover text-foreground shadow-sm dark:bg-foreground/20",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {/* Shows what the selected option does, and follows the selection. */}
      {preview && (
        <span
          className={cn("flex h-8 min-w-12 items-center justify-center", !selected?.bare && "rounded-md bg-well px-2")}
          aria-hidden
        >
          {preview}
        </span>
      )}
    </div>
  );
}

/** A grid-cell lookalike for the option previews. */
function Tile({ children }: { children?: React.ReactNode }) {
  return (
    <span className="flex size-5 items-center justify-center rounded-[5px] bg-foreground/15 text-[9px] font-semibold leading-none text-foreground/70">
      {children}
    </span>
  );
}

/** Two little groups of cells, pulled apart by `gaps` to show the divider spacing. */
function DividerPreview({ gaps, outlined = false }: { gaps: number; outlined?: boolean }) {
  // Months outline the empty slots outside the month, as the grid does.
  const group = (empty: number) => (
    <span className="grid grid-cols-2 gap-px">
      {Array.from({ length: 4 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-1.5 rounded-[2px]",
            outlined && i === empty ? "border border-foreground/20" : "bg-foreground/25",
          )}
        />
      ))}
    </span>
  );
  return (
    <span className="flex items-center" style={{ gap: gaps * 2 }}>
      {group(0)}
      {group(3)}
    </span>
  );
}

/** Two rows of cells, with or without weekday names beside them. */
function WeekdayPreview({ labels }: { labels: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {labels && (
        <span className="flex flex-col gap-0.5 text-[6px] leading-[8px] text-foreground/60">
          <span>Mo</span>
          <span>Tu</span>
        </span>
      )}
      <span className="flex flex-col gap-0.5">
        {[0, 1].map((r) => (
          <span key={r} className="flex gap-0.5">
            {[0, 1, 2].map((c) => (
              <span key={c} className="size-[8px] rounded-[2px] bg-foreground/25" />
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}

/** A larger cell like the grid's, with the day number in the top-left corner. */
function DayTile({ number }: { number?: string }) {
  return (
    <span className="relative size-8 rounded-[6px] bg-foreground/15">
      {number && (
        <span className="absolute top-[3px] left-[4px] text-[10px] font-medium leading-none tabular-nums text-foreground/55">
          {number}
        </span>
      )}
    </span>
  );
}
