"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { addDays, longDayLabel, weekdayLabel, type IsoDay } from "@/lib/dates";
import type { Divider, Segment } from "@/lib/grid";
import { cellBackground, type DayCell } from "@/lib/intensity";
import type { Category, Entry } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  segments: Segment[];
  cells: Map<IsoDay, DayCell>;
  entriesByDay: Map<IsoDay, Entry[]>;
  categoriesById: Map<string, Category>;
  /** Only entries in this category are listed in the tooltip, when set. */
  categoryId: string | null;
  today: IsoDay;
  weekStart: 0 | 1;
  divider: Divider;
  onSelectDay: (day: IsoDay) => void;
};

type Hover = { day: IsoDay; x: number; y: number; above: boolean };

export function ActivityGrid({
  segments,
  cells,
  entriesByDay,
  categoriesById,
  categoryId,
  today,
  weekStart,
  divider,
  onSelectDay,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  // Open on the most recent weeks, like the reference view.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [divider, weekStart, segments.length]);

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

  // Arrow keys move between days: ←/→ a week, ↑/↓ a day.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const day = (e.target as HTMLElement).dataset.day;
    if (!day) return;
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = scroller.current?.querySelector<HTMLElement>(`[data-day="${addDays(day, step)}"]`);
    next?.focus();
    next?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const rowDays = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
  const showMonthLabels = divider !== "month";
  const showSegmentLabels = divider !== "none";

  return (
    <div className="relative flex [--cell:15px] [--gap:3px] sm:[--cell:18px] sm:[--gap:4px] lg:[--cell:22px] lg:[--gap:5px]">
      {/* Weekday labels */}
      <div
        className={cn(
          "flex shrink-0 flex-col gap-(--gap) pr-2 text-[11px] text-muted-foreground",
          showSegmentLabels ? "pt-10" : "pt-5",
          "pb-3",
        )}
        aria-hidden
      >
        {rowDays.map((d) => (
          <div key={d} className="flex h-(--cell) items-center">
            {d % 2 === 1 ? weekdayLabel(d) : ""}
          </div>
        ))}
      </div>

      <div
        ref={scroller}
        className="grid-scroll min-w-0 flex-1 overflow-x-auto pb-2"
        onScroll={() => setHover(null)}
      >
        <div
          role="grid"
          aria-label="Activity by day"
          className={cn("flex w-max px-1 pb-1", divider === "year" ? "gap-6" : divider === "month" ? "gap-3" : "gap-0")}
          onPointerOver={(e) => showAt(e.target)}
          onPointerLeave={() => setHover(null)}
          onFocus={(e) => showAt(e.target)}
          onBlur={() => setHover(null)}
          onKeyDown={onKeyDown}
        >
          {segments.map((segment) => (
            <div key={segment.key} role="rowgroup">
              {showSegmentLabels && (
                <div className="h-5 text-xs font-medium tracking-tight text-foreground">
                  {segment.label}
                </div>
              )}
              <div className="flex h-5 gap-(--gap)" aria-hidden>
                {segment.columns.map((col) => (
                  <div key={col.key} className="relative w-(--cell)">
                    {showMonthLabels && col.label && (
                      <span className="absolute left-0 top-0 whitespace-nowrap text-[11px] text-muted-foreground">
                        {col.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-(--gap)">
                {segment.columns.map((col) => (
                  <div key={col.key} className="flex flex-col gap-(--gap)" role="row">
                    {col.days.map((day, i) =>
                      day ? (
                        <button
                          key={day}
                          type="button"
                          role="gridcell"
                          data-day={day}
                          aria-label={ariaLabel(day, entriesByDay.get(day), categoryId)}
                          onClick={() => onSelectDay(day)}
                          className={cn(
                            "size-(--cell) rounded-[4px] outline-none transition-[transform,box-shadow] duration-100",
                            "hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            day === today && "ring-2 ring-foreground/40 ring-offset-1 ring-offset-background",
                          )}
                          style={{ background: cellBackground(cells.get(day)) }}
                        />
                      ) : (
                        <span key={i} className="size-(--cell)" aria-hidden />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {hover && (
        <DayTooltip
          hover={hover}
          entries={entriesByDay.get(hover.day) ?? []}
          categoriesById={categoriesById}
          categoryId={categoryId}
          isFuture={hover.day > today}
        />
      )}
    </div>
  );
}

function scopedEntries(entries: Entry[] | undefined, categoryId: string | null) {
  if (!entries) return [];
  return categoryId ? entries.filter((e) => e.categoryId === categoryId) : entries;
}

function ariaLabel(day: IsoDay, entries: Entry[] | undefined, categoryId: string | null) {
  const n = scopedEntries(entries, categoryId).length;
  return `${longDayLabel(day)}: ${n === 0 ? "nothing logged" : `${n} logged`}`;
}

function DayTooltip({
  hover,
  entries,
  categoriesById,
  categoryId,
  isFuture,
}: {
  hover: Hover;
  entries: Entry[];
  categoriesById: Map<string, Category>;
  categoryId: string | null;
  isFuture: boolean;
}) {
  const shown = scopedEntries(entries, categoryId);
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
          {isFuture ? "Still to come" : "Nothing logged — click to add"}
        </div>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {shown.slice(0, 4).map((e) => {
            const cat = categoriesById.get(e.categoryId);
            return (
              <li key={e.id} className="flex items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-full" style={{ background: cat?.color }} />
                <span className="truncate">
                  {e.description || cat?.name}
                  {e.quantity != null && (
                    <span className="opacity-70">
                      {" "}
                      · {e.quantity}
                      {cat?.unit ? ` ${cat.unit}` : ""}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
          {extra > 0 && <li className="opacity-70">+{extra} more</li>}
        </ul>
      )}
    </div>
  );
}
