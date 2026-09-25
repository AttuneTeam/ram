"use client";

import { useRef, useState, useTransition } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { createEntry, deleteEntry, updateEntry } from "@/app/w/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar } from "@/components/Avatar";
import { Hint } from "@/components/Hint";
import { longDayLabel, type IsoDay } from "@/lib/dates";
import type { Category, Entry, Person } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  day: IsoDay | null;
  entries: Entry[];
  categories: Category[];
  people: Person[];
  /** Who "I" am on this device; pre-selects the "Logged by" picker. */
  me: string | null;
  onPickMe: (personId: string) => void;
  defaultCategoryId: string | null;
  /** View-only link: list the day's entries, no form or edit controls. */
  readOnly: boolean;
  onClose: () => void;
  onSaved: (entry: Entry) => void;
  onDeleted: (id: string) => void;
  onNewCategory: () => void;
};

export function DayDialog(props: Props) {
  return (
    <Dialog open={props.day !== null} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed by day so the form resets when another day is opened. */}
        {props.day && <DayBody key={props.day} {...props} day={props.day} />}
      </DialogContent>
    </Dialog>
  );
}

function DayBody({
  slug,
  day,
  entries,
  categories,
  people,
  me,
  onPickMe,
  defaultCategoryId,
  readOnly,
  onSaved,
  onDeleted,
  onNewCategory,
}: Props & { day: IsoDay }) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const [editing, setEditing] = useState<Entry | null>(null);
  // Only pre-select "me" if that person still exists.
  const [personId, setPersonId] = useState<string | null>(me && peopleById.has(me) ? me : null);
  const [categoryId, setCategoryId] = useState<string | null>(
    defaultCategoryId ?? categories[0]?.id ?? null,
  );
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pending, startTransition] = useTransition();
  const descriptionRef = useRef<HTMLInputElement>(null);

  const unit = categoryId ? byId.get(categoryId)?.unit : null;

  function reset() {
    setEditing(null);
    setPersonId(me && peopleById.has(me) ? me : null);
    setDescription("");
    setQuantity("");
    // Ready for the next entry without reaching for the mouse.
    requestAnimationFrame(() => descriptionRef.current?.focus());
  }

  function startEdit(entry: Entry) {
    setEditing(entry);
    setCategoryId(entry.categoryId);
    setPersonId(entry.personId);
    setDescription(entry.description);
    setQuantity(entry.quantity?.toString() ?? "");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) return;
    const q = quantity.trim() === "" ? null : Number(quantity);
    if (q !== null && (!Number.isFinite(q) || q < 0)) {
      toast.error("Amount must be a positive number");
      return;
    }
    const input = { categoryId, personId, day, description, quantity: q };
    startTransition(async () => {
      const res = editing ? await updateEntry(slug, editing.id, input) : await createEntry(slug, input);
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.data);
      // Logging as someone makes them "me" on this device for next time.
      if (!editing && personId) onPickMe(personId);
      reset();
    });
  }

  function remove(entry: Entry) {
    startTransition(async () => {
      const res = await deleteEntry(slug, entry.id);
      if (!res.ok) return void toast.error(res.error);
      onDeleted(entry.id);
      if (editing?.id === entry.id) reset();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl tracking-tight">{longDayLabel(day)}</DialogTitle>
        <DialogDescription>
          {entries.length === 0
            ? readOnly
              ? "Nothing logged this day."
              : "Nothing logged yet. What did you get done?"
            : `${entries.length} thing${entries.length === 1 ? "" : "s"} logged`}
        </DialogDescription>
      </DialogHeader>

      {entries.length > 0 && (
        <ul className="space-y-1.5">
          {entries.map((entry) => {
            const cat = byId.get(entry.categoryId);
            const author = entry.personId ? peopleById.get(entry.personId) : undefined;
            return (
              <li
                key={entry.id}
                className="group flex items-center gap-3 rounded-lg bg-well px-3 py-2 data-[editing=true]:ring-2 data-[editing=true]:ring-ring/40"
                data-editing={editing?.id === entry.id}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: cat?.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{entry.description || cat?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {cat?.name}
                    {entry.quantity != null && ` · ${entry.quantity}${cat?.unit ? ` ${cat.unit}` : ""}`}
                    {author && ` · ${author.name}`}
                  </div>
                </div>
                {author && <Avatar person={author} size="sm" />}
                {!readOnly && (
                  <>
                    <Hint label="Edit">
                      <Button variant="ghost" size="icon-sm" aria-label="Edit entry" onClick={() => startEdit(entry)} disabled={pending}>
                        <PencilIcon />
                      </Button>
                    </Hint>
                    <Hint label="Delete">
                      <Button variant="ghost" size="icon-sm" aria-label="Delete entry" onClick={() => remove(entry)} disabled={pending}>
                        <Trash2Icon />
                      </Button>
                    </Hint>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {readOnly ? null : categories.length === 0 ? (
        <div className="rounded-lg bg-well p-4 text-sm">
          <p className="text-muted-foreground">Create a category first — like “Exercise” or “Reading”.</p>
          <Button className="mt-3" size="sm" onClick={onNewCategory}>
            <PlusIcon /> New category
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {people.length > 0 && (
            <div className="space-y-1.5">
              <Label id="logged-by">Logged by</Label>
              <div role="radiogroup" aria-labelledby="logged-by" className="flex flex-wrap gap-1.5">
                {people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={personId === p.id}
                    onClick={() => setPersonId(p.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-sm text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      personId === p.id ? "bg-secondary text-secondary-foreground ring-2 ring-ring/40" : "hover:bg-hover",
                    )}
                  >
                    <Avatar person={p} size="sm" className={personId === p.id ? "bg-background" : undefined} />
                    {p.name.split(/\s+/)[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) => {
                      const cat = value ? byId.get(value) : null;
                      return cat ? (
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: cat.color }} />
                          {cat.name}
                        </span>
                      ) : (
                        "Pick one"
                      );
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Amount{unit ? ` (${unit})` : ""}</Label>
              <Input
                id="quantity"
                inputMode="decimal"
                placeholder="optional"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">What did you do?</Label>
            <Input
              id="description"
              ref={descriptionRef}
              placeholder="20 min kettlebell"
              maxLength={280}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            {editing && (
              <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
                Cancel
              </Button>
            )}
            {people.length > 0 && !personId && (
              <span className="mr-auto self-center text-xs text-muted-foreground">Pick who you are</span>
            )}
            <Button type="submit" disabled={pending || !categoryId || (people.length > 0 && !personId)}>
              {editing ? "Save" : "Log it"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
