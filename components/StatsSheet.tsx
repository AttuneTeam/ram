"use client";

import { useMemo, useState } from "react";
import { FlameIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { monthLabel, type IsoDay } from "@/lib/dates";
import { categoryStats, monthlyActivity, type MonthBucket } from "@/lib/stats";
import type { Category, Entry } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  entries: Entry[];
  today: IsoDay;
  weekStart: 0 | 1;
  initialCategoryId: string | null;
};

const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function StatsSheet({ open, onClose, categories, entries, today, weekStart, initialCategoryId }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const categoryId = picked ?? initialCategoryId ?? categories[0]?.id ?? null;
  const category = categories.find((c) => c.id === categoryId) ?? null;

  const all = useMemo(
    () => categories.map((c) => categoryStats(c, entries, today, weekStart)),
    [categories, entries, today, weekStart],
  );
  const stats = all.find((s) => s.category.id === categoryId) ?? null;
  const months = useMemo(
    () => (categoryId ? monthlyActivity(categoryId, entries, today) : []),
    [categoryId, entries, today],
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md!">
        <SheetHeader>
          <SheetTitle className="text-lg tracking-tight">Snapshot</SheetTitle>
          <SheetDescription>What you did, and the days you didn’t.</SheetDescription>
        </SheetHeader>

        {categories.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">Add a category to see stats.</p>
        ) : (
          <div className="space-y-6 px-4 pb-6">
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={c.id === categoryId}
                  onClick={() => setPicked(c.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    c.id === categoryId ? "bg-secondary text-secondary-foreground" : "hover:bg-hover",
                  )}
                >
                  <span className="size-2 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>

            {stats && category && (
              <>
                <div className="rounded-2xl bg-well p-5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FlameIcon className="size-3.5" /> Current streak
                  </div>
                  <div className="mt-1 text-5xl font-semibold tracking-tight">
                    {stats.currentStreak}
                    <span className="ml-1.5 text-base font-normal text-muted-foreground">
                      day{stats.currentStreak === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Longest: {stats.longestStreak} days</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Tile label="Days done" value={stats.activeDays} />
                  <Tile label="Days missed" value={stats.missedDays} hint={stats.firstDay ? "since you started" : undefined} />
                  <Tile label="Times logged" value={stats.entries} />
                  <Tile
                    label={category.unit ? `Total ${category.unit}` : "Total amount"}
                    value={stats.totalQuantity === null ? "—" : fmt.format(stats.totalQuantity)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Tile small label="This week" value={stats.thisWeek} />
                  <Tile small label="This month" value={stats.thisMonth} />
                  <Tile small label="This year" value={stats.thisYear} />
                </div>

                <MonthChart months={months} color={category.color} />
              </>
            )}

            <section>
              <h3 className="mb-2 text-sm font-medium">All categories</h3>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-1 text-left font-normal">Category</th>
                    <th className="pb-1 text-right font-normal">This year</th>
                    <th className="pb-1 text-right font-normal">Missed</th>
                    <th className="pb-1 text-right font-normal">Best streak</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {all.map((s) => (
                    <tr key={s.category.id}>
                      <td className="py-1">
                        <span className="flex items-center gap-2">
                          <span className="size-2 rounded-full" style={{ background: s.category.color }} />
                          {s.category.name}
                        </span>
                      </td>
                      <td className="py-1 text-right">{s.thisYear}</td>
                      <td className="py-1 text-right text-muted-foreground">{s.missedDays}</td>
                      <td className="py-1 text-right">{s.longestStreak}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Tile({ label, value, hint, small }: { label: string; value: number | string; hint?: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-well px-3.5 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("font-semibold tracking-tight", small ? "text-lg" : "text-2xl")}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Done vs missed days per month, stacked. Hover or focus a column for its numbers. */
function MonthChart({ months, color }: { months: MonthBucket[]; color: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...months.map((m) => m.active + m.missed));
  const shown = active === null ? null : months[active];

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium">Last 12 months</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-[3px]" style={{ background: color }} /> Done
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-[3px] bg-(--cell-empty)" /> Missed
          </span>
        </div>
      </div>
      <div className="h-5 text-xs text-muted-foreground" aria-live="polite">
        {shown ? (
          <>
            <span className="font-medium text-foreground">{shown.active} done</span> · {shown.missed} missed ·{" "}
            {monthLabel(`${shown.month}-01`)} {shown.month.slice(0, 4)}
          </>
        ) : (
          "Hover a month for details"
        )}
      </div>
      <div className="flex h-32 items-end gap-1.5" onPointerLeave={() => setActive(null)}>
        {months.map((m, i) => (
          <button
            key={m.month}
            type="button"
            aria-label={`${monthLabel(`${m.month}-01`)} ${m.month.slice(0, 4)}: ${m.active} done, ${m.missed} missed`}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className={cn(
              "flex h-full flex-1 flex-col justify-end gap-[2px] rounded-t-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active !== null && active !== i && "opacity-60",
            )}
          >
            {m.missed > 0 && (
              <span
                className="w-full rounded-t-[4px] bg-(--cell-empty)"
                style={{ height: `${(m.missed / max) * 100}%` }}
              />
            )}
            {m.active > 0 && (
              <span
                className={cn("w-full", m.missed === 0 && "rounded-t-[4px]")}
                style={{ height: `${(m.active / max) * 100}%`, background: color }}
              />
            )}
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-[10px] text-muted-foreground" aria-hidden>
        {months.map((m) => (
          <span key={m.month} className="flex-1 text-center">
            {monthLabel(`${m.month}-01`).slice(0, 1)}
          </span>
        ))}
      </div>
    </section>
  );
}
