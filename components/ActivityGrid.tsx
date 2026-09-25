"use client";

import { useLayoutEffect, useRef } from "react";
import { addDays, weekdayLabel } from "@/lib/dates";
import type { Divider, Segment } from "@/lib/grid";
import { cn } from "@/lib/utils";
import { CELL_VARS, DayButton, DayTooltip, useDayHover, type GridData } from "./grid/shared";

type Props = {
  segments: Segment[];
  data: GridData;
  weekStart: 0 | 1;
  divider: Divider;
};

/** Horizontal view: each week is a column, oldest on the left; scrolls sideways. */
export function ActivityGrid({ segments, data, weekStart, divider }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const { hover, hide, handlers } = useDayHover();

  // Open on the most recent weeks, like the reference view.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [divider, weekStart, segments.length]);

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
    <div className={cn("relative flex", CELL_VARS)}>
      {/* Weekday labels */}
      <div
        className={cn(
          "flex shrink-0 flex-col gap-(--gap) pr-2 pb-3 text-[11px] text-muted-foreground",
          showSegmentLabels ? "pt-10" : "pt-5",
        )}
        aria-hidden
      >
        {rowDays.map((d) => (
          <div key={d} className="flex h-(--cell) items-center">
            {d % 2 === 1 ? weekdayLabel(d) : ""}
          </div>
        ))}
      </div>

      <div ref={scroller} className="grid-scroll min-w-0 flex-1 overflow-x-auto pb-2" onScroll={hide}>
        <div
          role="grid"
          aria-label="Activity by day"
          className={cn("flex w-max px-1 pb-1", divider === "year" ? "gap-6" : divider === "month" ? "gap-3" : "gap-0")}
          onKeyDown={onKeyDown}
          {...handlers}
        >
          {segments.map((segment) => (
            <div key={segment.key} role="rowgroup">
              {showSegmentLabels && (
                <div className="h-5 text-xs font-medium tracking-tight text-foreground">{segment.label}</div>
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
                        <DayButton key={day} day={day} data={data} />
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

      <DayTooltip hover={hover} data={data} />
    </div>
  );
}
