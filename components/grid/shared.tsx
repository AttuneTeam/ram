"use client";

import { useCallback, useEffect, useState } from "react";
import { longDayLabel, type IsoDay } from "@/lib/dates";
import { cellBackground, type DayCell } from "@/lib/intensity";
import { initials } from "@/lib/people";
import type { Category, Entry, Person } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Everything both grid orientations need to draw and describe a day. */
export type GridData = {
  cells: Map<IsoDay, DayCell>;
  entriesByDay: Map<IsoDay, Entry[]>;
  categoriesById: Map<string, Category>;
  peopleById: Map<string, Person>;
  /** Only entries in this category are listed, when set. */
  categoryId: string | null;
  today: IsoDay;
  readOnly: boolean;
  onSelectDay: (day: IsoDay) => void;
};

/** Cell size and gap, stepped up with the viewport. Shared so both views match. */
export const CELL_VARS =
  "[--cell:15px] [--gap:3px] sm:[--cell:18px] sm:[--gap:4px] lg:[--cell:22px] lg:[--gap:5px]";

export function scopedEntries(entries: Entry[] | undefined, categoryId: string | null): Entry[] {
  if (!entries) return [];
  return categoryId ? entries.filter((e) => e.categoryId === categoryId) : entries;
}

type Hover = { day: IsoDay; x: number; y: number; above: boolean };

/**
 * One floating tooltip for the whole grid, driven by event delegation on the
 * grid container (hundreds of per-cell tooltip components would be wasteful).
 */
export function useDayHover() {
  const [hover, setHover] = useState<Hover | null>(null);

  const showAt = useCallback((target: EventTarget | null) => {
    const el = (target as HTMLElement | null)?.closest<HTMLElement>("[data-day]");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHover({
      day: el.dataset.day!,
      x: rect.left + rect.width / 2,
      // Flip below the cell when there's no room above.
      above: rect.top > 160,
      y: rect.top > 160 ? rect.top : rect.bottom,
    });
  }, []);

  const hide = useCallback(() => setHover(null), []);

  // The tooltip is position: fixed, so any scroll (page, pane or grid) would
  // leave it floating over the wrong day. Capture catches scrolls of any element.
  useEffect(() => {
    if (!hover) return;
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [hover, hide]);

  const handlers = {
    onPointerOver: (e: React.PointerEvent) => showAt(e.target),
    onPointerLeave: hide,
    onFocus: (e: React.FocusEvent) => showAt(e.target),
    onBlur: hide,
  };

  return { hover, hide, handlers };
}

export function DayButton({ day, data }: { day: IsoDay; data: GridData }) {
  const n = scopedEntries(data.entriesByDay.get(day), data.categoryId).length;
  return (
    <button
      type="button"
      role="gridcell"
      data-day={day}
      aria-label={`${longDayLabel(day)}: ${n === 0 ? "nothing logged" : `${n} logged`}`}
      onClick={() => data.onSelectDay(day)}
      className={cn(
        "size-(--cell) shrink-0 rounded-[4px] outline-none transition-[transform,box-shadow] duration-100",
        "hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        day === data.today && "ring-2 ring-foreground/40 ring-offset-1 ring-offset-background",
      )}
      style={{ background: cellBackground(data.cells.get(day)) }}
    />
  );
}

export function DayTooltip({ hover, data }: { hover: Hover | null; data: GridData }) {
  if (!hover) return null;
  const shown = scopedEntries(data.entriesByDay.get(hover.day), data.categoryId);
  const extra = shown.length - 4;
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none fixed z-50 w-max max-w-64 -translate-x-1/2 rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-[0px_12px_32px_rgba(56,56,49,0.18)]",
        hover.above ? "-translate-y-[calc(100%+8px)]" : "translate-y-2",
      )}
      style={{ left: hover.x, top: hover.y }}
    >
      <div className="font-medium">{longDayLabel(hover.day)}</div>
      {shown.length === 0 ? (
        <div className="mt-0.5 opacity-70">
          {data.readOnly ? "Nothing logged" : "Nothing logged — click to add"}
        </div>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {shown.slice(0, 4).map((e) => (
            <EntryLine key={e.id} entry={e} data={data} />
          ))}
          {extra > 0 && <li className="opacity-70">+{extra} more</li>}
        </ul>
      )}
    </div>
  );
}

function EntryLine({ entry, data }: { entry: Entry; data: GridData }) {
  const cat = data.categoriesById.get(entry.categoryId);
  const author = entry.personId ? data.peopleById.get(entry.personId) : undefined;
  return (
    <li className="flex items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-full" style={{ background: cat?.color }} />
      {author && (
        <span className="shrink-0 rounded-sm bg-background/20 px-1 text-[9px] font-semibold leading-tight">
          {initials(author.name)}
        </span>
      )}
      <span className="truncate">
        {entry.description || cat?.name}
        {entry.quantity != null && (
          <span className="opacity-70">
            {" "}
            · {entry.quantity}
            {cat?.unit ? ` ${cat.unit}` : ""}
          </span>
        )}
      </span>
    </li>
  );
}
