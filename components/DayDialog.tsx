"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { createEntry, deleteEntry, previewLink, updateEntry, type SavedEntry } from "@/app/w/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export function DayDialog(props: Props) {
  return (
    <Dialog open={props.day !== null} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed by day (and prefill) so the form resets when another day is opened. */}
        {props.day && <DayBody key={`${props.day}:${props.prefill?.key ?? ""}`} {...props} day={props.day} />}
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
  const [editing, setEditing] = useState<Entry | null>(null);
  // Only pre-select "me" if that person still exists.
  const [personId, setPersonId] = useState<string | null>(me && peopleById.has(me) ? me : null);
  const [categoryId, setCategoryId] = useState<string | null>(
    (prefill && byId.has(prefill.categoryId) ? prefill.categoryId : null) ?? defaultCategoryId ?? categories[0]?.id ?? null,
  );
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [quantity, setQuantity] = useState("");
  const [url, setUrl] = useState(prefill?.link.url ?? "");
  const [preview, setPreview] = useState<Link | null>(prefill?.link ?? null);
  const [previewing, setPreviewing] = useState(false);
  const [pending, startTransition] = useTransition();
  const descriptionRef = useRef<HTMLInputElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Only the latest lookup may set the preview; earlier ones can land late.
  const previewSeq = useRef(0);

  function showLink(value: string, link: Link | null = null) {
    clearTimeout(previewTimer.current);
    const seq = ++previewSeq.current;
    setUrl(value);
    const normalized = normalizeUrl(value);
    const known = link ?? (normalized ? [...linksById.values()].find((l) => l.url === normalized) : undefined);
    setPreview(known ?? null);
    setPreviewing(false);
    if (known || !normalized) return;
    // Wait for typing to settle; a paste goes through almost at once.
    setPreviewing(true);
    previewTimer.current = setTimeout(async () => {
      const res = await previewLink(slug, value);
      if (seq !== previewSeq.current) return;
      setPreviewing(false);
      setPreview(res.ok ? res.data : null);
    }, 400);
  }

  const unit = categoryId ? byId.get(categoryId)?.unit : null;

  function reset() {
    setEditing(null);
    setPersonId(me && peopleById.has(me) ? me : null);
    setDescription("");
    setQuantity("");
    showLink("");
    // Ready for the next entry without reaching for the mouse.
    requestAnimationFrame(() => descriptionRef.current?.focus());
  }

  function startEdit(entry: Entry) {
    setEditing(entry);
    setCategoryId(entry.categoryId);
    setPersonId(entry.personId);
    setDescription(entry.description);
    setQuantity(entry.quantity?.toString() ?? "");
    const link = entry.linkId ? linksById.get(entry.linkId) : undefined;
    showLink(link?.url ?? "", link ?? null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) return;
    const q = quantity.trim() === "" ? null : Number(quantity);
    if (q !== null && (!Number.isFinite(q) || q < 0)) {
      toast.error("Amount must be a positive number");
      return;
    }
    const input = { categoryId, personId, day, description, quantity: q, url };
    startTransition(async () => {
      const res = editing ? await updateEntry(slug, editing.id, input) : await createEntry(slug, input);
      if (!res.ok) return void toast.error(res.error);
      clearTimeout(previewTimer.current);
      onSaved(res.data);
      if (editing) return reset();
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
          <div className="space-y-1.5">
            <Label htmlFor="link">Link</Label>
            <div className="relative">
              <Input
                id="link"
                type="url"
                inputMode="url"
                placeholder="Paste a YouTube video or any web page"
                value={url}
                onChange={(e) => showLink(e.target.value)}
                className={url ? "pr-8" : undefined}
              />
              {previewing ? (
                <Loader2Icon className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : (
                url && (
                  <button
                    type="button"
                    aria-label="Remove link"
                    onClick={() => showLink("")}
                    className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                )
              )}
            </div>
            {preview && <LinkCard link={preview} />}
            {url && !previewing && !preview && !normalizeUrl(url) && (
              <p className="text-xs text-muted-foreground">That doesn’t look like a web link.</p>
            )}
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
