"use client";

import { useMemo, useRef } from "react";
import { addDays, weekdayLabel, type IsoDay } from "@/lib/dates";
import { newestFirst, verticalMonthLabels, type Divider, type Segment } from "@/lib/grid";
import { cn } from "@/lib/utils";
import { CELL_VARS, DayButton, DayTooltip, scopedEntries, useDayHover, type GridData } from "./grid/shared";

type Props = {
  segments: Segment[];
  data: GridData;
  weekStart: 0 | 1;
  divider: Divider;
};

/**
 * Vertical view: each week is a row, newest at the top, so today is where you
 * land and scrolling down goes back in time. The page (or the layout's right
 * pane) does the scrolling; this component just grows.
 */
export function VerticalGrid({ segments, data, weekStart, divider }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const { hover, handlers } = useDayHover();
  const ordered = useMemo(
    () => newestFirst(segments).map((s) => ({ ...s, monthLabels: verticalMonthLabels(s.columns) })),
    [segments],
  );

  // Newest week is on top: ↑ goes forward a week, ↓ back a week, ←/→ a day.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const day = (e.target as HTMLElement).dataset.day;
    if (!day) return;
    const step = { ArrowUp: 7, ArrowDown: -7, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = root.current?.querySelector<HTMLElement>(`[data-day="${addDays(day, step)}"]`);
    next?.focus();
    next?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const weekdays = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
  const showMonthLabels = divider !== "month";
  const showSegmentLabels = divider !== "none";

  return (
    <div ref={root} className={cn("relative", CELL_VARS)}>
      {/* Weekday header, pinned while scrolling */}
      <div
        className="sticky top-0 z-10 -mx-1 flex items-end gap-3 bg-popover px-1 pt-3 pb-2 dark:bg-card"
        aria-hidden
      >
        {showMonthLabels && <div className="w-9 shrink-0" />}
        <div className="flex gap-(--gap)">
          {weekdays.map((d) => (
            <span key={d} className="w-(--cell) text-center text-[10px] text-muted-foreground">
              {weekdayLabel(d).slice(0, 2)}
            </span>
          ))}
        </div>
      </div>

      <div
        role="grid"
        aria-label="Activity by day, newest week first"
        className={cn("flex flex-col", divider === "year" ? "gap-8" : divider === "month" ? "gap-5" : "gap-0")}
        onKeyDown={onKeyDown}
        {...handlers}
      >
        {ordered.map((segment) => (
          <div key={segment.key} role="rowgroup" className="flex flex-col gap-(--gap)">
            {showSegmentLabels && (
              <div className={cn("mb-1 text-xs font-medium tracking-tight text-foreground", showMonthLabels && "pl-12")}>
                {segment.label}
              </div>
            )}
            {segment.columns.map((week, w) => (
              <div key={week.key} role="row" className="flex items-center gap-3">
                {showMonthLabels && (
                  <div className="w-9 shrink-0 text-right text-[11px] text-muted-foreground" aria-hidden>
                    {segment.monthLabels[w]}
                  </div>
                )}
                <div className="flex gap-(--gap)">
                  {week.days.map((day, i) =>
                    day ? (
                      <DayButton key={day} day={day} data={data} />
                    ) : (
                      <span key={i} className="size-(--cell) shrink-0" aria-hidden />
                    ),
                  )}
                </div>
                <WeekNotes days={week.days} data={data} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <DayTooltip hover={hover} data={data} />
    </div>
  );
}

/**
 * What was logged that week, in day order, on one line beside the squares.
 * The squares show consistency; this shows what it actually was.
 */
function WeekNotes({ days, data }: { days: (IsoDay | null)[]; data: GridData }) {
  const entries = days.flatMap((d) => (d ? scopedEntries(data.entriesByDay.get(d), data.categoryId) : []));
  if (entries.length === 0) return <div className="min-w-0 flex-1" />;

  const text = entries.map((e) => e.description || data.categoriesById.get(e.categoryId)?.name || "").join(" · ");
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-xs text-muted-foreground [mask-image:linear-gradient(to_right,black_85%,transparent)]"
      title={text}
    >
      {entries.slice(0, 12).map((e, i) => {
        const cat = data.categoriesById.get(e.categoryId);
        return (
          <span key={e.id} className={cn("flex min-w-0 shrink-0 items-center gap-1", i > 0 && "before:mr-0.5 before:content-['·']")}>
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: cat?.color }} aria-hidden />
            <span className="whitespace-nowrap">{e.description || cat?.name}</span>
          </span>
        );
      })}
    </div>
  );
}
