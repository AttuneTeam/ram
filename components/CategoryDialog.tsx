"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { createCategory, deleteCategory, updateCategory } from "@/app/w/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SWATCHES } from "@/lib/palette";
import { shade } from "@/lib/intensity";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

/** `category` undefined = closed, null = creating, Category = editing. */
type Props = {
  slug: string;
  category: Category | null | undefined;
  usedColors: string[];
  onClose: () => void;
  onSaved: (category: Category) => void;
  onDeleted: (id: string) => void;
};

export function CategoryDialog(props: Props) {
  return (
    <Dialog open={props.category !== undefined} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-sm">
        {props.category !== undefined && (
          <CategoryForm key={props.category?.id ?? "new"} {...props} category={props.category} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  slug,
  category,
  usedColors,
  onClose,
  onSaved,
  onDeleted,
}: Props & { category: Category | null }) {
  const [name, setName] = useState(category?.name ?? "");
  const [unit, setUnit] = useState(category?.unit ?? "");
  const [color, setColor] = useState(
    category?.color ?? SWATCHES.find((s) => !usedColors.includes(s)) ?? SWATCHES[0],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { name, color, unit };
    startTransition(async () => {
      const res = category ? await updateCategory(slug, category.id, input) : await createCategory(slug, input);
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.data);
      onClose();
    });
  }

  function remove() {
    if (!category) return;
    startTransition(async () => {
      const res = await deleteCategory(slug, category.id);
      if (!res.ok) return void toast.error(res.error);
      onDeleted(category.id);
      onClose();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
        <DialogDescription>Each category gets its own colour on the grid.</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="cat-name">Name</Label>
        <Input
          id="cat-name"
          placeholder="Exercise"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cat-unit">Unit for amounts</Label>
        <Input
          id="cat-unit"
          placeholder="min, pages, km… (optional)"
          maxLength={16}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Colour</Label>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`Colour ${s}`}
              aria-pressed={color === s}
              onClick={() => setColor(s)}
              className="grid size-7 place-items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ background: s }}
            >
              {color === s && <CheckIcon className="size-4 text-white" />}
            </button>
          ))}
          <label
            className={cn(
              "relative grid size-7 cursor-pointer place-items-center rounded-md bg-well text-xs text-muted-foreground",
              !SWATCHES.includes(color) && "ring-2 ring-ring",
            )}
            title="Custom colour"
          >
            +
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        {/* Preview of the four shades as they'll appear on the grid. */}
        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
          Less
          {([1, 2, 3, 4] as const).map((l) => (
            <span
              key={l}
              className="size-4 rounded-[4px]"
              style={{ background: shade(color, l) }}
            />
          ))}
          More
        </div>
      </div>

      <DialogFooter className="items-center sm:justify-between">
        {category ? (
          confirmDelete ? (
            <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
              Delete it and its entries
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending}>
              Delete
            </Button>
          )
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending || !name.trim()}>
          {category ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}
