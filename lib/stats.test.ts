import { categoryStats, monthlyActivity, streaks } from "./stats";
import type { Category, Entry } from "./types";

const cat: Category = { id: "ex", name: "Exercise", color: "#3b6fd1", unit: "min", sortOrder: 0 };

let n = 0;
function entry(day: string, quantity: number | null = null, categoryId = "ex"): Entry {
  return { id: `e${n++}`, categoryId, day, description: "", quantity, personId: null, createdAt: day };
}

describe("streaks", () => {
  it("counts the longest run of consecutive days", () => {
    expect(streaks(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-10"], "2026-09-20").longestStreak).toBe(3);
  });

  it("keeps the current streak alive until a full day is missed", () => {
    const days = ["2026-09-23", "2026-09-24"];
    expect(streaks(days, "2026-09-24").currentStreak).toBe(2);
    expect(streaks(days, "2026-09-25").currentStreak).toBe(2); // today not logged yet
    expect(streaks(days, "2026-09-26").currentStreak).toBe(0);
  });

  it("is zero with no days", () => {
    expect(streaks([], "2026-09-25")).toEqual({ currentStreak: 0, longestStreak: 0 });
  });
});

describe("categoryStats", () => {
  it("summarises done, missed and totals", () => {
    const entries = [
      entry("2026-09-20", 20),
      entry("2026-09-20", 10), // same day: one active day, two entries
      entry("2026-09-22", 30),
      entry("2026-09-25", null),
      entry("2026-09-24", 99, "other"),
    ];
    const s = categoryStats(cat, entries, "2026-09-25", 1);
    expect(s.entries).toBe(4);
    expect(s.activeDays).toBe(3);
    expect(s.missedDays).toBe(3); // 20..25 is 6 days, 3 done
    expect(s.totalQuantity).toBe(60);
    expect(s.thisWeek).toBe(2); // week of Mon 21 Sep
    expect(s.currentStreak).toBe(1);
  });

  it("reports no quantity for a count-only category", () => {
    expect(categoryStats(cat, [entry("2026-09-01")], "2026-09-25", 1).totalQuantity).toBeNull();
  });
});

describe("monthlyActivity", () => {
  it("returns oldest-first buckets and doesn't count months before tracking began", () => {
    const months = monthlyActivity("ex", [entry("2026-08-30"), entry("2026-09-01"), entry("2026-09-02")], "2026-09-10", 3);
    expect(months.map((m) => m.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(months[0]).toEqual({ month: "2026-07", active: 0, missed: 0 });
    expect(months[1]).toEqual({ month: "2026-08", active: 1, missed: 1 }); // 30–31 Aug tracked
    expect(months[2]).toEqual({ month: "2026-09", active: 2, missed: 8 }); // up to today
  });

  it("wraps across the year boundary", () => {
    const months = monthlyActivity("ex", [], "2026-02-15", 3);
    expect(months.map((m) => m.month)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});
