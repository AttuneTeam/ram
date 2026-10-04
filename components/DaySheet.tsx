"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronLeftIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { createEntry, deleteEntry, updateEntry } from "@/app/w/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

export function DaySheet(props: Props) {
  return (
    <Sheet open={props.day !== null} onOpenChange={(open) => !open && props.onClose()}>
      <SheetContent className="data-[side=right]:w-full min-[480px]:max-w-md!">
        {/* Keyed by day so the form resets when another day is opened. */}
        {props.day && <DayBody key={props.day} {...props} day={props.day} />}
      </SheetContent>
    </Sheet>
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
  // `editing` drives the slide; `shown` outlives it so the edit view keeps its content while sliding out.
  const [editing, setEditing] = useState<Entry | null>(null);
  // With entries already logged, the form stays tucked behind an "Add" button.
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const showForm = adding || entries.length === 0;
  const [shown, setShown] = useState<Entry | null>(null);
  // Only pre-select "me" if that person still exists.
  const [personId, setPersonId] = useState<string | null>(me && peopleById.has(me) ? me : null);
  const [categoryId, setCategoryId] = useState<string | null>(
    defaultCategoryId ?? categories[0]?.id ?? null,
  );
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pending, startTransition] = useTransition();
  const descriptionRef = useRef<HTMLInputElement>(null);

  function startEdit(entry: Entry) {
    setShown(entry);
    setEditing(entry);
  }

  function closeEdit() {
    setEditing(null);
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
      const res = await createEntry(slug, input);
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.data);
      // Logging as someone makes them "me" on this device for next time.
      if (personId) onPickMe(personId);
      setPersonId(me && peopleById.has(me) ? me : null);
      setDescription("");
      setQuantity("");
      setAdding(false);
    });
  }

  function remove(entry: Entry) {
    startTransition(async () => {
      const res = await deleteEntry(slug, entry.id);
      if (!res.ok) return void toast.error(res.error);
      setDeleting(null);
      onDeleted(entry.id);
      if (editing?.id === entry.id) closeEdit();
    });
  }

  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          "grid h-full grid-cols-[100%_100%] transition-transform duration-300 ease-out motion-reduce:transition-none",
          editing && "-translate-x-full",
        )}
      >
        <div className="flex flex-col gap-4 overflow-y-auto p-4" inert={editing !== null} aria-hidden={editing !== null}>
      <SheetHeader className="p-0 pr-8">
        <SheetTitle className="text-xl tracking-tight">{longDayLabel(day)}</SheetTitle>
        <SheetDescription>
          {entries.length === 0
            ? readOnly
              ? "Nothing logged this day."
              : "Nothing logged yet. What did you get done?"
            : `${entries.length} thing${entries.length === 1 ? "" : "s"} logged`}
        </SheetDescription>
      </SheetHeader>

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
                      <Button variant="ghost" size="icon-sm" aria-label="Delete entry" onClick={() => setDeleting(entry)} disabled={pending}>
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
      ) : !showForm ? (
        <Button onClick={() => setAdding(true)}>
          <PlusIcon /> Add
        </Button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <EntryFields
            idPrefix="new"
            people={people}
            categories={categories}
            personId={personId}
            setPersonId={setPersonId}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            quantity={quantity}
            setQuantity={setQuantity}
            description={description}
            setDescription={setDescription}
            descriptionRef={descriptionRef}
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-1">
            {entries.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => setAdding(false)} disabled={pending}>
                Cancel
              </Button>
            )}
            {people.length > 0 && !personId && (
              <span className="mr-auto self-center text-xs text-muted-foreground">Pick who you are</span>
            )}
            <Button type="submit" disabled={pending || !categoryId || (people.length > 0 && !personId)}>
              Log it
            </Button>
          </div>
        </form>
      )}
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4" inert={editing === null} aria-hidden={editing === null}>
          {shown && (
            <EditPanel
              key={shown.id}
              slug={slug}
              day={day}
              entry={shown}
              categories={categories}
              people={people}
              onCancel={closeEdit}
              onSaved={(entry) => {
                onSaved(entry);
                closeEdit();
              }}
              onDeleted={(id) => {
                onDeleted(id);
                closeEdit();
              }}
            />
          )}
        </div>
      </div>
      <ConfirmDelete
        entry={deleting}
        categories={categories}
        day={day}
        pending={pending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
      />
    </div>
  );
}

type FieldsProps = {
  idPrefix: string;
  people: Person[];
  categories: Category[];
  personId: string | null;
  setPersonId: (id: string) => void;
  categoryId: string | null;
  setCategoryId: (id: string) => void;
  quantity: string;
  setQuantity: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  descriptionRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
};

function EntryFields({
  idPrefix: id,
  people,
  categories,
  personId,
  setPersonId,
  categoryId,
  setCategoryId,
  quantity,
  setQuantity,
  description,
  setDescription,
  descriptionRef,
  autoFocus,
}: FieldsProps) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const unit = categoryId ? byId.get(categoryId)?.unit : null;
  return (
    <>
          {people.length > 0 && (
            <div className="space-y-1.5">
              <Label id={`${id}-logged-by`}>Logged by</Label>
              <div role="radiogroup" aria-labelledby={`${id}-logged-by`} className="flex flex-wrap gap-1.5">
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
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-description`}>What did you do?</Label>
            <Input
              id={`${id}-description`}
              ref={descriptionRef}
              placeholder="20 min kettlebell"
              maxLength={280}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus={autoFocus}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-quantity`}>Amount{unit ? ` (${unit})` : ""}</Label>
            <Input
              id={`${id}-quantity`}
              inputMode="decimal"
              placeholder="optional"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
    </>
  );
}

function EditPanel({
  slug,
  day,
  entry,
  categories,
  people,
  onCancel,
  onSaved,
  onDeleted,
}: {
  slug: string;
  day: IsoDay;
  entry: Entry;
  categories: Category[];
  people: Person[];
  onCancel: () => void;
  onSaved: (entry: Entry) => void;
  onDeleted: (id: string) => void;
}) {
  const [personId, setPersonId] = useState<string | null>(entry.personId);
  const [categoryId, setCategoryId] = useState<string | null>(entry.categoryId);
  const [description, setDescription] = useState(entry.description);
  const [quantity, setQuantity] = useState(entry.quantity?.toString() ?? "");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) return;
    const q = quantity.trim() === "" ? null : Number(quantity);
    if (q !== null && (!Number.isFinite(q) || q < 0)) {
      toast.error("Amount must be a positive number");
      return;
    }
    startTransition(async () => {
      const res = await updateEntry(slug, entry.id, { categoryId, personId, day, description, quantity: q });
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.data);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteEntry(slug, entry.id);
      if (!res.ok) return void toast.error(res.error);
      setConfirming(false);
      onDeleted(entry.id);
    });
  }

  return (
    <>
      <SheetHeader className="p-0 pr-8">
        <div className="flex items-center gap-2">
          <Hint label="Back">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Back" onClick={onCancel} disabled={pending}>
              <ChevronLeftIcon />
            </Button>
          </Hint>
          <SheetTitle className="text-xl tracking-tight">Edit entry</SheetTitle>
        </div>
        <SheetDescription>{longDayLabel(day)}</SheetDescription>
      </SheetHeader>
      <form onSubmit={submit} className="space-y-3">
        <EntryFields
          idPrefix="edit"
          people={people}
          categories={categories}
          personId={personId}
          setPersonId={setPersonId}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          quantity={quantity}
          setQuantity={setQuantity}
          description={description}
          setDescription={setDescription}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="destructive" className="mr-auto" onClick={() => setConfirming(true)} disabled={pending}>
            <Trash2Icon /> Delete
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !categoryId}>
            Save
          </Button>
        </div>
      </form>
      <ConfirmDelete
        entry={confirming ? entry : null}
        categories={categories}
        day={day}
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={remove}
      />
    </>
  );
}

function ConfirmDelete({
  entry,
  categories,
  day,
  pending,
  onCancel,
  onConfirm,
}: {
  /** The entry awaiting confirmation; null = closed. */
  entry: Entry | null;
  categories: Category[];
  day: IsoDay;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Keep the last entry around so the text doesn't blank while the dialog fades out.
  const [last, setLast] = useState(entry);
  if (entry && entry !== last) setLast(entry);
  const label = last && (last.description || categories.find((c) => c.id === last.categoryId)?.name);
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete this entry?</DialogTitle>
          <DialogDescription>
            “{label}” will be removed from {longDayLabel(day)}. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
