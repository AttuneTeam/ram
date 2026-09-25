"use client";

import { useMemo, useRef } from "react";
import { addDays, weekdayLabel } from "@/lib/dates";
import { newestFirst, verticalMonthLabels, type Divider, type Segment } from "@/lib/grid";
import { cn } from "@/lib/utils";
import { CELL_VARS, DayButton, DayTooltip, useDayHover, type GridData } from "./grid/shared";

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
              </div>
            ))}
          </div>
        ))}
      </div>

      <DayTooltip hover={hover} data={data} />
    </div>
  );
}
