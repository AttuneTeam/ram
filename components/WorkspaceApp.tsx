"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3Icon,
  Columns3Icon,
  EyeIcon,
  LinkIcon,
  MoonIcon,
  PlusIcon,
  Rows3Icon,
  Settings2Icon,
  SunIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ActivityGrid } from "@/components/ActivityGrid";
import type { GridData } from "@/components/grid/shared";
import { Avatar } from "@/components/Avatar";
import { CategoryDialog } from "@/components/CategoryDialog";
import { DayDialog } from "@/components/DayDialog";
import { Hint } from "@/components/Hint";
import { PersonDialog } from "@/components/PersonDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ShareDialog } from "@/components/ShareDialog";
import { StatsSheet } from "@/components/StatsSheet";
import { VerticalGrid } from "@/components/VerticalGrid";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { rememberWorkspace } from "@/lib/recent";
import { buildGrid, gridStart } from "@/lib/grid";
import { cellBackground, shade, shadeDays } from "@/lib/intensity";
import type { IsoDay } from "@/lib/dates";
import { useMe } from "@/lib/me";
import { useOrientation } from "@/lib/orientation";
import type { Category, Entry, Person, Workspace } from "@/lib/types";
import { useToday } from "@/lib/useToday";
import { cn } from "@/lib/utils";

type Props = {
  workspace: Workspace;
  categories: Category[];
  people: Person[];
  entries: Entry[];
  isNew?: boolean;
  /** Opened through the view-only link: no editing, and no edit slug in `workspace`. */
  readOnly?: boolean;
};

export function WorkspaceApp({ readOnly = false, isNew = false, ...props }: Props) {
  const today = useToday();
  const { theme, toggleTheme } = useTheme();

  const [workspace, setWorkspace] = useState(props.workspace);
  const [categories, setCategories] = useState(props.categories);
  const [people, setPeople] = useState(props.people);
  const [entries, setEntries] = useState(props.entries);
  const [filter, setFilter] = useState<string | null>(null);
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<IsoDay | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null | undefined>(undefined);
  const [editingPerson, setEditingPerson] = useState<Person | null | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [me, setMe] = useMe(workspace.slug);
  const [orientation, setOrientation] = useOrientation();

  useEffect(() => {
    // The view link doesn't carry the edit slug, so there's nothing to remember.
    if (!readOnly) rememberWorkspace(workspace.slug, workspace.name);
  }, [readOnly, workspace.slug, workspace.name]);

  const welcomed = useRef(false);
  useEffect(() => {
    if (!isNew || welcomed.current) return;
    welcomed.current = true;
    toast.success("Your workspace is ready", {
      description: "Bookmark this page — the link is the only way back in.",
      duration: 8000,
    });
    window.history.replaceState(null, "", `/w/${workspace.slug}`);
  }, [isNew, workspace.slug]);

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  // Picking a person narrows everything below — grid, tooltips, stats — to their entries.
  const visibleEntries = useMemo(
    () => (personFilter ? entries.filter((e) => e.personId === personFilter) : entries),
    [entries, personFilter],
  );

  const entriesByDay = useMemo(() => {
    const map = new Map<IsoDay, Entry[]>();
    for (const e of visibleEntries) {
      const list = map.get(e.day) ?? [];
      list.push(e);
      map.set(e.day, list);
    }
    return map;
  }, [visibleEntries]);

  const cells = useMemo(() => shadeDays(visibleEntries, categories, filter), [visibleEntries, categories, filter]);

  const { divider, weekStart } = workspace.settings;
  const segments = useMemo(() => {
    if (!today) return [];
    // Span everyone's history, so switching person doesn't change the grid's width.
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
  const filterPerson = personFilter ? peopleById.get(personFilter) : null;
  // "All" mixes category colours per cell, so its legend shows intensity in neutral grey.
  const legendColor = filterCategory?.color ?? "var(--muted-foreground)";

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

  function upsertPerson(person: Person) {
    setPeople((prev) =>
      prev.some((p) => p.id === person.id) ? prev.map((p) => (p.id === person.id ? person : p)) : [...prev, person],
    );
  }

  function removePerson(id: string) {
    setPeople((prev) => prev.filter((p) => p.id !== id));
    // The database keeps their entries and clears the attribution; mirror that.
    setEntries((prev) => prev.map((e) => (e.personId === id ? { ...e, personId: null } : e)));
    if (personFilter === id) setPersonFilter(null);
    if (me === id) setMe(null);
  }

  let summary = `${loggedDays} day${loggedDays === 1 ? "" : "s"} with ${filterCategory ? filterCategory.name.toLowerCase() : "something logged"}`;
  if (filterPerson) summary += ` by ${filterPerson.name.split(/\s+/)[0]}`;

  const gridData: GridData | null = today
    ? { cells, entriesByDay, categoriesById, peopleById, categoryId: filter, today, readOnly, onSelectDay: setOpenDay }
    : null;

  // ── Pieces shared by both layouts ────────────────────────────────────────

  const eyebrow = (
    <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
      Ram
      {readOnly && (
        <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] tracking-normal normal-case text-secondary-foreground">
          <EyeIcon className="size-3" /> View only
        </span>
      )}
    </p>
  );

  const peopleRow = (people.length > 0 || !readOnly) && (
    <div className="flex flex-wrap items-center gap-1" aria-label="Filter by person" role="group">
      {people.map((p) => (
        <Hint
          key={p.id}
          label={
            personFilter === p.id ? (
              <>
                Showing {p.name}
                <span className="block opacity-70">Click to show everyone</span>
              </>
            ) : (
              `Show only ${p.name}`
            )
          }
        >
          <button
            type="button"
            aria-pressed={personFilter === p.id}
            aria-label={`Show only ${p.name}`}
            onClick={() => setPersonFilter(personFilter === p.id ? null : p.id)}
            className={cn(
              "rounded-full outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring",
              personFilter && personFilter !== p.id && "opacity-40 hover:opacity-80",
              personFilter === p.id && "ring-2 ring-ring ring-offset-2 ring-offset-background",
            )}
          >
            <Avatar person={p} title={null} />
          </button>
        </Hint>
      ))}
      {!readOnly &&
        (people.length === 0 ? (
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => setEditingPerson(null)}>
            <UserPlusIcon /> Add people
          </Button>
        ) : (
          <Hint label="Add a person">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground"
              aria-label="Add a person"
              onClick={() => setEditingPerson(null)}
            >
              <PlusIcon />
            </Button>
          </Hint>
        ))}
    </div>
  );

  const nextOrientation = orientation === "vertical" ? "horizontal" : "vertical";
  const actions = (
    <div className="flex flex-wrap items-center gap-1">
      {!readOnly && (
        <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)}>
          <LinkIcon /> Share
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => setStatsOpen(true)}>
        <BarChart3Icon /> Stats
      </Button>
      {!readOnly && (
        <Hint label="Settings">
          <Button variant="ghost" size="icon-sm" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings2Icon />
          </Button>
        </Hint>
      )}
      <Hint label={`Switch to ${nextOrientation} view`}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Switch to ${nextOrientation} view`}
          onClick={() => setOrientation(nextOrientation)}
        >
          {orientation === "vertical" ? <Columns3Icon /> : <Rows3Icon />}
        </Button>
      </Hint>
      <Hint label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </Button>
      </Hint>
    </div>
  );

  const categoryChips = (stacked: boolean) => (
    <nav
      aria-label="Filter by category"
      className={cn("flex flex-wrap items-center gap-1.5", stacked && "lg:flex-col lg:flex-nowrap lg:items-start lg:gap-1")}
    >
      <Chip active={filter === null} onClick={() => setFilter(null)}>
        All
      </Chip>
      {categories.map((c) => (
        <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(filter === c.id ? null : c.id)}>
          <span className="size-2 rounded-full" style={{ background: c.color }} />
          {c.name}
        </Chip>
      ))}
      {!readOnly && (
        <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => setEditingCategory(null)}>
          <PlusIcon /> Category
        </Button>
      )}
    </nav>
  );

  const legend = (
    <span className="flex items-center gap-1" aria-hidden>
      Less
      <span className="size-3 rounded-[3px]" style={{ background: cellBackground(undefined) }} />
      {([1, 2, 3, 4] as const).map((l) => (
        <span key={l} className="size-3 rounded-[3px]" style={{ background: shade(legendColor, l) }} />
      ))}
      More
    </span>
  );

  const hint = readOnly
    ? "Click any day to see what was logged. Arrow keys move between days."
    : "Click any day to log what you did. Arrow keys move between days.";

  const dialogs = (
    <>
      <DayDialog
        slug={workspace.slug}
        day={openDay}
        entries={openDay ? (entriesByDay.get(openDay) ?? []) : []}
        categories={categories}
        people={people}
        me={me}
        onPickMe={setMe}
        defaultCategoryId={filter}
        readOnly={readOnly}
        onClose={() => setOpenDay(null)}
        onSaved={upsertEntry}
        onDeleted={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))}
        onNewCategory={() => setEditingCategory(null)}
      />
      {today && (
        <StatsSheet
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          categories={categories}
          entries={visibleEntries}
          today={today}
          weekStart={weekStart}
          initialCategoryId={filter}
        />
      )}
      {!readOnly && (
        <>
          <CategoryDialog
            slug={workspace.slug}
            category={editingCategory}
            usedColors={categories.map((c) => c.color)}
            onClose={() => setEditingCategory(undefined)}
            onSaved={upsertCategory}
            onDeleted={removeCategory}
          />
          <PersonDialog
            slug={workspace.slug}
            person={editingPerson}
            onClose={() => setEditingPerson(undefined)}
            onSaved={upsertPerson}
            onDeleted={removePerson}
          />
          <SettingsDialog
            open={settingsOpen}
            workspace={workspace}
            categories={categories}
            people={people}
            onClose={() => setSettingsOpen(false)}
            onWorkspaceChange={setWorkspace}
            onEditCategory={setEditingCategory}
            onEditPerson={setEditingPerson}
          />
          <ShareDialog
            open={shareOpen}
            workspace={workspace}
            onClose={() => setShareOpen(false)}
            onWorkspaceChange={setWorkspace}
          />
        </>
      )}
    </>
  );

  // Orientation lives in this browser, so it's unknown until hydration. Render
  // nothing rather than one layout and then jump to the other.
  if (!orientation) return <main className="min-h-dvh" />;

  // ── Vertical: sidebar on the left, the grid in its own scrolling pane ────

  if (orientation === "vertical") {
    return (
      <main className="w-full lg:grid lg:h-dvh lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-6 px-4 pt-8 pb-4 sm:px-8 lg:overflow-y-auto lg:py-12 lg:pr-4">
          <div className="min-w-0">
            {eyebrow}
            <h1 className="text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{workspace.name}</h1>
            {peopleRow && <div className="mt-3">{peopleRow}</div>}
          </div>
          <div className="-ml-2.5">{actions}</div>
          {categoryChips(true)}
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>{summary}</p>
            {legend}
          </div>
          <p className="mt-auto hidden text-xs text-muted-foreground lg:block">{hint}</p>
        </aside>
        {/* The pane itself has no vertical padding: sticky elements pin to the
            scroll container's padding edge, so padding here would leave a gap
            above the weekday header for rows to show through. */}
        <section className="px-4 pb-8 sm:px-8 lg:overflow-y-auto lg:pb-0 lg:pl-4" aria-label="Activity">
          <div className="w-fit max-w-full rounded-2xl bg-popover p-4 sm:p-6 lg:my-12 dark:bg-card">
            {gridData ? (
              <VerticalGrid segments={segments} data={gridData} weekStart={weekStart} divider={divider} />
            ) : (
              <div className="h-96" />
            )}
          </div>
        </section>
        {dialogs}
      </main>
    );
  }

  // ── Horizontal: the original layout ──────────────────────────────────────

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow}
          <h1 className="truncate text-3xl font-semibold tracking-tight sm:text-4xl">{workspace.name}</h1>
          {peopleRow && <div className="mt-3">{peopleRow}</div>}
        </div>
        {actions}
      </header>

      <div className="mt-8">{categoryChips(false)}</div>

      <section className="mt-4 rounded-2xl bg-popover p-4 sm:p-6 dark:bg-card">
        {gridData ? (
          <ActivityGrid segments={segments} data={gridData} weekStart={weekStart} divider={divider} />
        ) : (
          <div className="h-[168px] sm:h-[196px] lg:h-[224px]" />
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{summary}</span>
          {legend}
        </div>
      </section>

      <p className="mt-4 hidden text-xs text-muted-foreground sm:block">{hint}</p>

      {dialogs}
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
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}
