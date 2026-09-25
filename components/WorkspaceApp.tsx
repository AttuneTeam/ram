"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3Icon, LinkIcon, MoonIcon, PlusIcon, Settings2Icon, SunIcon } from "lucide-react";
import { toast } from "sonner";
import { ActivityGrid } from "@/components/ActivityGrid";
import { CategoryDialog } from "@/components/CategoryDialog";
import { DayDialog } from "@/components/DayDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { StatsSheet } from "@/components/StatsSheet";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { rememberWorkspace } from "@/lib/recent";
import { buildGrid, gridStart } from "@/lib/grid";
import { cellBackground, shade, shadeDays } from "@/lib/intensity";
import type { IsoDay } from "@/lib/dates";
import type { Category, Entry, Workspace } from "@/lib/types";
import { useToday } from "@/lib/useToday";
import { cn } from "@/lib/utils";

type Props = {
  workspace: Workspace;
  categories: Category[];
  entries: Entry[];
  isNew: boolean;
};

export function WorkspaceApp(props: Props) {
  const today = useToday();
  const { theme, toggleTheme } = useTheme();

  const [workspace, setWorkspace] = useState(props.workspace);
  const [categories, setCategories] = useState(props.categories);
  const [entries, setEntries] = useState(props.entries);
  const [filter, setFilter] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<IsoDay | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  useEffect(() => {
    rememberWorkspace(workspace.slug, workspace.name);
  }, [workspace.slug, workspace.name]);

  const welcomed = useRef(false);
  useEffect(() => {
    if (!props.isNew || welcomed.current) return;
    welcomed.current = true;
    toast.success("Your workspace is ready", {
      description: "Bookmark this page — the link is the only way back in.",
      duration: 8000,
    });
    window.history.replaceState(null, "", `/w/${workspace.slug}`);
  }, [props.isNew, workspace.slug]);

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const entriesByDay = useMemo(() => {
    const map = new Map<IsoDay, Entry[]>();
    for (const e of entries) {
      const list = map.get(e.day) ?? [];
      list.push(e);
      map.set(e.day, list);
    }
    return map;
  }, [entries]);

  const cells = useMemo(() => shadeDays(entries, categories, filter), [entries, categories, filter]);

  const { divider, weekStart } = workspace.settings;
  const segments = useMemo(() => {
    if (!today) return [];
    const earliest = entries[0]?.day ?? null; // entries arrive sorted by day
    return buildGrid({ from: gridStart(today, earliest), to: today, weekStart, divider });
  }, [today, entries, weekStart, divider]);

  const loggedDays = useMemo(() => {
    if (!today || segments.length === 0) return 0;
    let n = 0;
    for (const [day, cell] of cells) if (cell.level > 0 && day <= today) n++;
    return n;
  }, [cells, today, segments.length]);

  const filterCategory = filter ? categoriesById.get(filter) : null;
  // "All" mixes category colours per cell, so its legend shows intensity in neutral grey.
  const legendColor = filterCategory?.color ?? "var(--muted-foreground)";

  async function copyLink() {
    const url = `${window.location.origin}/w/${workspace.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", {
        description: workspace.hasPin
          ? "They'll need your PIN to open it."
          : "Anyone with this link can view and edit. Add a PIN in settings to lock it.",
      });
    } catch {
      toast(url);
    }
  }

  function upsertEntry(entry: Entry) {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== entry.id);
      next.push(entry);
      return next.sort((a, b) => a.day.localeCompare(b.day) || a.createdAt.localeCompare(b.createdAt));
    });
  }

  function upsertCategory(category: Category) {
    setCategories((prev) =>
      prev.some((c) => c.id === category.id)
        ? prev.map((c) => (c.id === category.id ? category : c))
        : [...prev, category],
    );
  }

  function removeCategory(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setEntries((prev) => prev.filter((e) => e.categoryId !== id));
    if (filter === id) setFilter(null);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Ram</p>
          <h1 className="truncate text-3xl font-semibold tracking-tight sm:text-4xl">{workspace.name}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={copyLink}>
            <LinkIcon /> Share
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setStatsOpen(true)}>
            <BarChart3Icon /> Stats
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings2Icon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={toggleTheme}>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
      </header>

      <nav aria-label="Filter by category" className="mt-8 flex flex-wrap items-center gap-1.5">
        <Chip active={filter === null} onClick={() => setFilter(null)}>
          All
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(filter === c.id ? null : c.id)}>
            <span className="size-2 rounded-full" style={{ background: c.color }} />
            {c.name}
          </Chip>
        ))}
        <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => setEditingCategory(null)}>
          <PlusIcon /> Category
        </Button>
      </nav>

      <section className="mt-4 rounded-2xl bg-popover p-4 sm:p-6 dark:bg-card">
        {today ? (
          <ActivityGrid
            segments={segments}
            cells={cells}
            entriesByDay={entriesByDay}
            categoriesById={categoriesById}
            categoryId={filter}
            today={today}
            weekStart={weekStart}
            divider={divider}
            onSelectDay={setOpenDay}
          />
        ) : (
          <div className="h-[168px] sm:h-[196px] lg:h-[224px]" />
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {loggedDays} day{loggedDays === 1 ? "" : "s"} with {filterCategory ? filterCategory.name.toLowerCase() : "something logged"}
          </span>
          <span className="flex items-center gap-1" aria-hidden>
            Less
            <span className="size-3 rounded-[3px]" style={{ background: cellBackground(undefined) }} />
            {([1, 2, 3, 4] as const).map((l) => (
              <span
                key={l}
                className="size-3 rounded-[3px]"
                style={{ background: shade(legendColor, l) }}
              />
            ))}
            More
          </span>
        </div>
      </section>

      <p className="mt-4 hidden text-xs text-muted-foreground sm:block">
        Click any day to log what you did. Arrow keys move between days.
      </p>

      <DayDialog
        slug={workspace.slug}
        day={openDay}
        entries={openDay ? (entriesByDay.get(openDay) ?? []) : []}
        categories={categories}
        defaultCategoryId={filter}
        onClose={() => setOpenDay(null)}
        onSaved={upsertEntry}
        onDeleted={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))}
        onNewCategory={() => setEditingCategory(null)}
      />
      <CategoryDialog
        slug={workspace.slug}
        category={editingCategory}
        usedColors={categories.map((c) => c.color)}
        onClose={() => setEditingCategory(undefined)}
        onSaved={upsertCategory}
        onDeleted={removeCategory}
      />
      <SettingsDialog
        open={settingsOpen}
        workspace={workspace}
        categories={categories}
        onClose={() => setSettingsOpen(false)}
        onWorkspaceChange={setWorkspace}
        onEditCategory={setEditingCategory}
      />
      {today && (
        <StatsSheet
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          categories={categories}
          entries={entries}
          today={today}
          weekStart={weekStart}
          initialCategoryId={filter}
        />
      )}
    </main>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-full px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
