"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronLeftIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { createEntry, deleteEntry, previewLink, updateEntry, type SavedEntry } from "@/app/w/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar } from "@/components/Avatar";
import { Hint } from "@/components/Hint";
import { LinkCard } from "@/components/LinkCard";
import { longDayLabel, type IsoDay } from "@/lib/dates";
import { normalizeUrl } from "@/lib/links";
import type { Category, Entry, Link, Person } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Starts the form filled in, e.g. "Log again" from the library. */
export type DayPrefill = {
  /** Changes every time, so the form resets even for the same link twice. */
  key: string;
  categoryId: string;
  description: string;
  link: Link;
};

/** The link field's state: the URL as typed, plus a (debounced) preview of what it points at. */
function useLinkField(slug: string, linksById: Map<string, Link>, initial: Link | null) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [preview, setPreview] = useState<Link | null>(initial);
  const [previewing, setPreviewing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Only the latest lookup may set the preview; earlier ones can land late.
  const seq = useRef(0);

  function show(value: string, link: Link | null = null) {
    clearTimeout(timer.current);
    const mine = ++seq.current;
    setUrl(value);
    const normalized = normalizeUrl(value);
    const known = link ?? (normalized ? [...linksById.values()].find((l) => l.url === normalized) : undefined);
    setPreview(known ?? null);
    setPreviewing(false);
    if (known || !normalized) return;
    // Wait for typing to settle; a paste goes through almost at once.
    setPreviewing(true);
    timer.current = setTimeout(async () => {
      const res = await previewLink(slug, value);
      if (mine !== seq.current) return;
      setPreviewing(false);
      setPreview(res.ok ? res.data : null);
    }, 400);
  }

  return { url, preview, previewing, show, stop: () => clearTimeout(timer.current) };
}
type LinkField = ReturnType<typeof useLinkField>;

type Props = {
  slug: string;
  day: IsoDay | null;
  entries: Entry[];
  categories: Category[];
  people: Person[];
  linksById: Map<string, Link>;
  prefill: DayPrefill | null;
  /** Who "I" am on this device; pre-selects the "Logged by" picker. */
  me: string | null;
  onPickMe: (personId: string) => void;
  defaultCategoryId: string | null;
  /** View-only link: list the day's entries, no form or edit controls. */
  readOnly: boolean;
  onClose: () => void;
  onSaved: (saved: SavedEntry) => void;
  onDeleted: (id: string) => void;
  onNewCategory: () => void;
};

export function DaySheet(props: Props) {
  return (
    <Sheet open={props.day !== null} onOpenChange={(open) => !open && props.onClose()}>
      <SheetContent className="data-[side=right]:w-full min-[480px]:max-w-md!">
        {/* Keyed by day (and prefill) so the form resets when another day is opened. */}
        {props.day && <DayBody key={`${props.day}:${props.prefill?.key ?? ""}`} {...props} day={props.day} />}
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
  linksById,
  prefill,
  me,
  onPickMe,
  defaultCategoryId,
  readOnly,
  onClose,
  onSaved,
  onDeleted,
  onNewCategory,
}: Props & { day: IsoDay }) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const peopleById = new Map(people.map((p) => [p.id, p]));
  // `editing` drives the slide; `shown` outlives it so the edit view keeps its content while sliding out.
  const [editing, setEditing] = useState<Entry | null>(null);
  // With entries already logged, the form stays tucked behind an "Add" button.
  const [adding, setAdding] = useState(prefill !== null);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const showForm = adding || entries.length === 0;
  const [shown, setShown] = useState<Entry | null>(null);
  // Only pre-select "me" if that person still exists.
  const [personId, setPersonId] = useState<string | null>(me && peopleById.has(me) ? me : null);
  const [categoryId, setCategoryId] = useState<string | null>(
    (prefill && byId.has(prefill.categoryId) ? prefill.categoryId : null) ?? defaultCategoryId ?? categories[0]?.id ?? null,
  );
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [quantity, setQuantity] = useState("");
  const linkField = useLinkField(slug, linksById, prefill?.link ?? null);
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
    const input = { categoryId, personId, day, description, quantity: q, url: linkField.url };
    startTransition(async () => {
      const res = await createEntry(slug, input);
      if (!res.ok) return void toast.error(res.error);
      linkField.stop();
      onSaved(res.data);
      // Logging as someone makes them "me" on this device for next time.
      if (personId) onPickMe(personId);
      onClose();
      const { entry, link } = res.data;
      const what = entry.description || link?.title || byId.get(entry.categoryId)?.name;
      toast.success(what ? `Logged “${what}”` : "Logged", { description: longDayLabel(day) });
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
            const link = entry.linkId ? linksById.get(entry.linkId) : undefined;
            return (
              <li
                key={entry.id}
                className="group flex items-center gap-3 rounded-lg bg-well px-3 py-2 data-[editing=true]:ring-2 data-[editing=true]:ring-ring/40"
                data-editing={editing?.id === entry.id}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: cat?.color }} />
                <div className="min-w-0 flex-1">
                  {/* With no note, the link itself is the headline rather than repeating its title. */}
                  {link && !entry.description ? (
                    <LinkCard link={link} variant="row" className="text-sm text-foreground" />
                  ) : (
                    <div className="truncate text-sm">{entry.description || cat?.name}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {cat?.name}
                    {entry.quantity != null && ` · ${entry.quantity}${cat?.unit ? ` ${cat.unit}` : ""}`}
                    {author && ` · ${author.name}`}
                  </div>
                  {link && entry.description && <LinkCard link={link} variant="row" className="mt-1.5" />}
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
            link={linkField}
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
              linksById={linksById}
              onCancel={closeEdit}
              onSaved={(saved) => {
                onSaved(saved);
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
  link: LinkField;
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
  link,
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
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-link`}>Link</Label>
        <div className="relative">
          <Input
            id={`${id}-link`}
            type="url"
            inputMode="url"
            placeholder="Paste a YouTube video or any web page"
            value={link.url}
            onChange={(e) => link.show(e.target.value)}
            className={link.url ? "pr-8" : undefined}
          />
          {link.previewing ? (
            <Loader2Icon className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            link.url && (
              <button
                type="button"
                aria-label="Remove link"
                onClick={() => link.show("")}
                className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <XIcon className="size-3.5" />
              </button>
            )
          )}
        </div>
        {link.preview && <LinkCard link={link.preview} />}
        {link.url && !link.previewing && !link.preview && !normalizeUrl(link.url) && (
          <p className="text-xs text-muted-foreground">That doesn’t look like a web link.</p>
        )}
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
  linksById,
  onSaved,
  onDeleted,
}: {
  slug: string;
  day: IsoDay;
  entry: Entry;
  linksById: Map<string, Link>;
  categories: Category[];
  people: Person[];
  onCancel: () => void;
  onSaved: (saved: SavedEntry) => void;
  onDeleted: (id: string) => void;
}) {
  const [personId, setPersonId] = useState<string | null>(entry.personId);
  const [categoryId, setCategoryId] = useState<string | null>(entry.categoryId);
  const [description, setDescription] = useState(entry.description);
  const [quantity, setQuantity] = useState(entry.quantity?.toString() ?? "");
  const linkField = useLinkField(slug, linksById, entry.linkId ? (linksById.get(entry.linkId) ?? null) : null);
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
      const res = await updateEntry(slug, entry.id, { categoryId, personId, day, description, quantity: q, url: linkField.url });
      if (!res.ok) return void toast.error(res.error);
      linkField.stop();
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
          link={linkField}
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
