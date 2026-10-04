"use client";

import { useMemo, useState, useTransition } from "react";
import { RotateCcwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteLink } from "@/app/w/[slug]/actions";
import { Hint } from "@/components/Hint";
import { LinkCard } from "@/components/LinkCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { diffDays, monthLabel, type IsoDay } from "@/lib/dates";
import { buildLibrary, hostLabel, type LibraryItem } from "@/lib/links";
import type { Category, Entry, Link, Person } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  slug: string;
  categories: Category[];
  people: Person[];
  /** Already narrowed to the selected person, like the grid. */
  entries: Entry[];
  links: Link[];
  today: IsoDay;
  initialCategoryId: string | null;
  readOnly: boolean;
  onLogAgain: (item: LibraryItem) => void;
  onDeleted: (id: string) => void;
};

function whenLabel(day: IsoDay, today: IsoDay): string {
  const ago = diffDays(today, day);
  if (ago === 0) return "today";
  if (ago === 1) return "yesterday";
  if (ago < 7) return `${ago} days ago`;
  const label = `${Number(day.slice(8))} ${monthLabel(day)}`;
  return day.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${day.slice(0, 4)}`;
}

/** Every video and page you've logged, to find again and do again. */
export function LibrarySheet(props: Props) {
  const { open, onClose, slug, categories, people, entries, links, today, initialCategoryId, readOnly } = props;
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<LibraryItem | null>(null);
  // Kept after closing so the dialog text doesn't blank while it fades out.
  const [lastRemoving, setLastRemoving] = useState<LibraryItem | null>(null);
  if (removing && removing !== lastRemoving) setLastRemoving(removing);
  const categoryId = picked === undefined ? initialCategoryId : picked;

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const all = useMemo(() => buildLibrary(entries, links), [entries, links]);
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((item) => {
      if (categoryId && !item.entries.some((e) => e.categoryId === categoryId)) return false;
      if (!q) return true;
      const { title, description, siteName, url } = item.link;
      const haystack = [title, description, siteName, hostLabel(url), ...item.entries.map((e) => e.description)];
      return haystack.some((s) => s?.toLowerCase().includes(q));
    });
  }, [all, categoryId, query]);

  // Only offer categories that have something in the library.
  const usedCategories = categories.filter((c) => all.some((item) => item.entries.some((e) => e.categoryId === c.id)));

  function remove(item: LibraryItem) {
    startTransition(async () => {
      const res = await deleteLink(slug, item.link.id);
      if (!res.ok) return void toast.error(res.error);
      setRemoving(null);
      props.onDeleted(item.link.id);
      toast.success("Removed from the library", { description: "Its entries are still logged." });
    });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {/* Focus the search only with a keyboard: on a phone it would pop the keyboard over the list. */}
      <SheetContent className="data-[side=right]:w-full overflow-y-auto min-[480px]:max-w-md!" initialFocus={(type) => type === "keyboard"}>
        <SheetHeader>
          <SheetTitle className="text-lg tracking-tight">Library</SheetTitle>
          <SheetDescription>Videos and pages you’ve logged, most recent first.</SheetDescription>
        </SheetHeader>

        {all.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            Nothing here yet. Add a link when you log something, like the YouTube video you worked out to, and it’ll
            show up here.
          </p>
        ) : (
          <div className="space-y-4 px-4 pb-6">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search"
                aria-label="Search the library"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {usedCategories.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={categoryId === null} onClick={() => setPicked(null)}>
                  All
                </FilterChip>
                {usedCategories.map((c) => (
                  <FilterChip key={c.id} active={categoryId === c.id} onClick={() => setPicked(categoryId === c.id ? null : c.id)}>
                    <span className="size-2 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </FilterChip>
                ))}
              </div>
            )}

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing matches.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => {
                  const last = item.entries[0];
                  const cats = [...new Set(item.entries.map((e) => e.categoryId))].flatMap((id) => categoriesById.get(id) ?? []);
                  const who = [...new Set(item.entries.flatMap((e) => (e.personId ? [e.personId] : [])))]
                    .flatMap((id) => peopleById.get(id)?.name.split(/\s+/)[0] ?? []);
                  const times = item.entries.length;
                  return (
                    <li key={item.link.id} className="rounded-md bg-well">
                      <LinkCard link={item.link} className="rounded-md bg-transparent" />
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pb-2 text-xs text-muted-foreground">
                        <span className="flex shrink-0 -space-x-0.5">
                          {cats.map((c) => (
                            <span key={c.id} title={c.name} className="size-2 rounded-full ring-2 ring-well" style={{ background: c.color }} />
                          ))}
                        </span>
                        {/* Wraps the buttons onto their own line when narrow, instead of truncating. */}
                        <span className="min-w-40 flex-1">
                          {times === 1 ? "Once" : `${times} times`} · last {whenLabel(item.lastDay, today)}
                          {who.length > 0 && ` · ${who.join(", ")}`}
                        </span>
                        {!readOnly && (
                          <span className="ml-auto flex items-center gap-1">
                            <Hint label="Remove from library">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Remove from library"
                                disabled={pending}
                                onClick={() => setRemoving(item)}
                              >
                                <Trash2Icon />
                              </Button>
                            </Hint>
                            <Button variant="secondary" size="sm" onClick={() => props.onLogAgain(item)} disabled={pending}>
                              <RotateCcwIcon /> Log again
                            </Button>
                          </span>
                        )}
                      </div>
                      {last.description && last.description !== item.link.title && (
                        <p className="-mt-1 truncate px-3 pb-2.5 text-xs text-muted-foreground italic">“{last.description}”</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </SheetContent>

      <Dialog open={removing !== null} onOpenChange={(o) => !o && !pending && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove “{lastRemoving?.link.title ?? lastRemoving?.link.url}” from the library?</DialogTitle>
            <DialogDescription>Its entries are still logged. This can’t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)} disabled={pending}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => removing && remove(removing)} disabled={pending}>
              {pending ? "Removing…" : "Remove link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-secondary text-secondary-foreground" : "hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}
