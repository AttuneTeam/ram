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
import { longDayLabel, type IsoDay } from "@/lib/dates";
import type { Category, Entry } from "@/lib/types";

type Props = {
  slug: string;
  day: IsoDay | null;
  entries: Entry[];
  categories: Category[];
  defaultCategoryId: string | null;
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
  defaultCategoryId,
  onSaved,
  onDeleted,
  onNewCategory,
}: Props & { day: IsoDay }) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const [editing, setEditing] = useState<Entry | null>(null);
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
    setDescription("");
    setQuantity("");
    // Ready for the next entry without reaching for the mouse.
    requestAnimationFrame(() => descriptionRef.current?.focus());
  }

  function startEdit(entry: Entry) {
    setEditing(entry);
    setCategoryId(entry.categoryId);
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
    const input = { categoryId, day, description, quantity: q };
    startTransition(async () => {
      const res = editing ? await updateEntry(slug, editing.id, input) : await createEntry(slug, input);
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.data);
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
            ? "Nothing logged yet. What did you get done?"
            : `${entries.length} thing${entries.length === 1 ? "" : "s"} logged`}
        </DialogDescription>
      </DialogHeader>

      {entries.length > 0 && (
        <ul className="space-y-1.5">
          {entries.map((entry) => {
            const cat = byId.get(entry.categoryId);
            return (
              <li
                key={entry.id}
                className="group flex items-center gap-3 rounded-lg bg-accent/60 px-3 py-2 data-[editing=true]:ring-2 data-[editing=true]:ring-ring/40"
                data-editing={editing?.id === entry.id}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: cat?.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{entry.description || cat?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {cat?.name}
                    {entry.quantity != null && ` · ${entry.quantity}${cat?.unit ? ` ${cat.unit}` : ""}`}
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Edit entry" onClick={() => startEdit(entry)} disabled={pending}>
                  <PencilIcon />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Delete entry" onClick={() => remove(entry)} disabled={pending}>
                  <Trash2Icon />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {categories.length === 0 ? (
        <div className="rounded-lg bg-accent/60 p-4 text-sm">
          <p className="text-muted-foreground">Create a category first — like “Exercise” or “Reading”.</p>
          <Button className="mt-3" size="sm" onClick={onNewCategory}>
            <PlusIcon /> New category
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
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
            <Button type="submit" disabled={pending || !categoryId}>
              {editing ? "Save" : "Log it"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
