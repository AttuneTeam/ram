"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
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
  const [edges, setEdges] = useState({ back: false, forward: false });

  // Which way there's more to see, so the arrows only show when they'd move.
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const back = el.scrollLeft > 1;
    const forward = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((prev) => (prev.back === back && prev.forward === forward ? prev : { back, forward }));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  // Page by most of the visible width, keeping a few weeks for context.
  const page = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  // Open on the most recent weeks, like the reference view.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
    measure();
  }, [divider, weekStart, segments.length, measure]);

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

      <div
        ref={scroller}
        className="grid-scroll min-w-0 flex-1 overflow-x-auto pb-2"
        onScroll={() => {
          hide();
          measure();
        }}
      >
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

      <ScrollArrow side="back" visible={edges.back} onClick={() => page(-1)} />
      <ScrollArrow side="forward" visible={edges.forward} onClick={() => page(1)} />

      <DayTooltip hover={hover} data={data} />
    </div>
  );
}

/**
 * A round button that pages the grid, centred on the card's edge so it covers
 * as few cells as possible. The offsets match the card's padding (p-4 sm:p-6)
 * in WorkspaceApp. Hidden when there's nothing further that way.
 */
function ScrollArrow({ side, visible, onClick }: { side: "back" | "forward"; visible: boolean; onClick: () => void }) {
  const back = side === "back";
  const label = back ? "Earlier weeks" : "Later weeks";
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 flex items-center transition-opacity",
        back ? "-left-4 -translate-x-1/2 sm:-left-6" : "-right-4 translate-x-1/2 sm:-right-6",
        visible ? "opacity-100" : "invisible opacity-0",
      )}
    >
      <Hint label={label}>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          className="pointer-events-auto rounded-full shadow-sm"
        >
          {back ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </Button>
      </Hint>
    </div>
  );
}
