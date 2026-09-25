import { addDays, isValidDay, startOfWeek, weekday } from "./dates";
import { buildGrid, gridStart, MIN_WEEKS, newestFirst, verticalMonthLabels } from "./grid";

describe("dates", () => {
  it("finds the start of the week for either convention", () => {
    // 2026-09-25 is a Friday.
    expect(startOfWeek("2026-09-25", 1)).toBe("2026-09-21");
    expect(startOfWeek("2026-09-25", 0)).toBe("2026-09-20");
    expect(startOfWeek("2026-09-21", 1)).toBe("2026-09-21");
  });

  it("does day arithmetic across month, year and DST boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30"); // EU DST switch
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("rejects impossible dates", () => {
    expect(isValidDay("2026-02-30")).toBe(false);
    expect(isValidDay("2026-9-1")).toBe(false);
    expect(isValidDay("2024-02-29")).toBe(true);
  });
});

describe("gridStart", () => {
  it("shows at least a year", () => {
    expect(gridStart("2026-09-25", null)).toBe(addDays("2026-09-25", -(MIN_WEEKS * 7 - 1)));
  });

  it("reaches back to older entries", () => {
    expect(gridStart("2026-09-25", "2024-01-03")).toBe("2024-01-03");
  });
});

describe("buildGrid", () => {
  const today = "2026-09-25"; // Friday

  it("puts every day in exactly one cell, ending today", () => {
    const [segment] = buildGrid({ from: "2026-01-01", to: today, weekStart: 1, divider: "none" });
    const days = segment.columns.flatMap((c) => c.days).filter(Boolean) as string[];
    expect(days[0]).toBe("2025-12-29"); // Monday of the week holding 1 Jan
    expect(days.at(-1)).toBe(today);
    expect(new Set(days).size).toBe(days.length);
    for (let i = 1; i < days.length; i++) expect(days[i]).toBe(addDays(days[i - 1], 1));
  });

  it("rows follow the configured week start", () => {
    for (const weekStart of [0, 1] as const) {
      const [segment] = buildGrid({ from: "2026-06-01", to: today, weekStart, divider: "none" });
      for (const col of segment.columns) {
        col.days.forEach((d, row) => {
          if (d) expect(weekday(d)).toBe((row + weekStart) % 7);
        });
      }
    }
  });

  it("leaves the rest of the current week empty", () => {
    const [segment] = buildGrid({ from: "2026-09-01", to: today, weekStart: 1, divider: "none" });
    expect(segment.columns.at(-1)!.days).toEqual([
      "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", null, null,
    ]);
  });

  it("labels the column holding the 1st of each month", () => {
    const [segment] = buildGrid({ from: "2026-07-01", to: today, weekStart: 1, divider: "none" });
    const labels = segment.columns.filter((c) => c.label).map((c) => c.label);
    expect(labels).toEqual(["Jul", "Aug", "Sep"]); // first column (29 Jun) holds 1 Jul
  });

  it("names the first partial month unless a label would collide", () => {
    const early = buildGrid({ from: "2026-06-10", to: today, weekStart: 1, divider: "none" })[0];
    expect(early.columns[0].label).toBe("Jun");
    const crowded = buildGrid({ from: "2026-06-25", to: today, weekStart: 1, divider: "none" })[0];
    expect(crowded.columns[0].label).toBeUndefined(); // 1 Jul is in the next column
  });

  it("splits a straddling week across month segments", () => {
    const segments = buildGrid({ from: "2026-09-01", to: "2026-10-03", weekStart: 1, divider: "month" });
    expect(segments.map((s) => s.label)).toEqual(["Aug 2026", "Sep 2026", "Oct 2026"]);
    const lastSep = segments[1].columns.at(-1)!.days;
    const firstOct = segments[2].columns[0].days;
    // Week of Mon 28 Sep: Sep keeps Mon–Wed, Oct gets Thu–Sat.
    expect(lastSep).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", null, null, null, null]);
    expect(firstOct).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", null]);
  });

  it("groups by year", () => {
    const segments = buildGrid({ from: "2025-12-20", to: "2026-01-10", weekStart: 1, divider: "year" });
    expect(segments.map((s) => s.key)).toEqual(["2025", "2026"]);
    const all = segments.flatMap((s) => s.columns.flatMap((c) => c.days)).filter(Boolean);
    expect(all.every((d, i, arr) => i === 0 || d! > arr[i - 1]!)).toBe(true);
  });
});

describe("newestFirst", () => {
  it("puts the current week first and keeps days in week order", () => {
    const segments = buildGrid({ from: "2026-08-01", to: "2026-09-25", weekStart: 1, divider: "none" });
    const [segment] = newestFirst(segments);
    expect(segment.columns[0].days).toEqual([
      "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", null, null,
    ]);
    const firsts = segment.columns.map((c) => c.days.find(Boolean)!);
    expect(firsts).toEqual([...firsts].sort().reverse());
  });

  it("orders month segments newest first", () => {
    const segments = buildGrid({ from: "2026-07-15", to: "2026-09-25", weekStart: 1, divider: "month" });
    expect(newestFirst(segments).map((s) => s.label)).toEqual(["Sep 2026", "Aug 2026", "Jul 2026"]);
  });

  it("doesn't mutate the input", () => {
    const segments = buildGrid({ from: "2026-08-01", to: "2026-09-25", weekStart: 1, divider: "month" });
    const before = JSON.stringify(segments);
    newestFirst(segments);
    expect(JSON.stringify(segments)).toBe(before);
  });
});

describe("verticalMonthLabels", () => {
  it("labels each month on its newest week, reading top-down", () => {
    // Weeks (Mon start) from 27 Jul to the current week of 21–25 Sep, newest first.
    const [segment] = newestFirst(buildGrid({ from: "2026-08-01", to: "2026-09-25", weekStart: 1, divider: "none" }));
    const labels = verticalMonthLabels(segment.columns);
    const firstDays = segment.columns.map((c) => c.days.find(Boolean));
    expect(firstDays).toEqual([
      "2026-09-21", "2026-09-14", "2026-09-07", "2026-08-31",
      "2026-08-24", "2026-08-17", "2026-08-10", "2026-08-03", "2026-07-27",
    ]);
    // Sep on the top row. The week of 31 Aug ends in Sep, so Aug starts one row
    // lower, on 24–30 Aug. The bottom week ends 2 Aug, so it's still Aug.
    expect(labels).toEqual(["Sep", undefined, undefined, undefined, "Aug", undefined, undefined, undefined, undefined]);
  });
});
