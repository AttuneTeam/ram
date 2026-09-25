import { cellBackground, levelFor, percentile, shadeDays } from "./intensity";
import type { Category, Entry } from "./types";

const exercise: Category = { id: "ex", name: "Exercise", color: "#3b6fd1", unit: "min", sortOrder: 0 };
const reading: Category = { id: "rd", name: "Reading", color: "#c8701c", unit: "pages", sortOrder: 1 };

let n = 0;
function entry(categoryId: string, day: string, quantity: number | null = null): Entry {
  return { id: `e${n++}`, categoryId, day, description: "", quantity, createdAt: `${day}T00:00:0${n % 10}Z` };
}

describe("levelFor", () => {
  it("is 0 for nothing and 1–4 otherwise", () => {
    expect(levelFor(0, 10)).toBe(0);
    expect(levelFor(1, 10)).toBe(1);
    expect(levelFor(5, 10)).toBe(2);
    expect(levelFor(10, 10)).toBe(4);
    expect(levelFor(50, 10)).toBe(4); // clamps outliers
  });
});

describe("percentile", () => {
  it("handles empty and single inputs", () => {
    expect(percentile([], 0.9)).toBe(0);
    expect(percentile([7], 0.9)).toBe(7);
  });
});

describe("shadeDays", () => {
  it("shades a single category by summed quantity — more is darker", () => {
    const entries = [
      entry("ex", "2026-09-01", 10),
      entry("ex", "2026-09-02", 20),
      entry("ex", "2026-09-02", 20),
      entry("rd", "2026-09-03", 100),
    ];
    const cells = shadeDays(entries, [exercise, reading], "ex");
    expect(cells.get("2026-09-01")!.level).toBeLessThan(cells.get("2026-09-02")!.level);
    expect(cells.get("2026-09-02")!.value).toBe(40);
    expect(cells.has("2026-09-03")).toBe(false); // other category ignored
    expect(cells.get("2026-09-01")!.color).toBe(exercise.color);
  });

  it("falls back to entry count when a category has no quantities", () => {
    const entries = [entry("rd", "2026-09-01"), entry("rd", "2026-09-02"), entry("rd", "2026-09-02")];
    const cells = shadeDays(entries, [exercise, reading], "rd");
    expect(cells.get("2026-09-01")!.value).toBe(1);
    expect(cells.get("2026-09-02")!.value).toBe(2);
  });

  it("in the all view, colours by the day's most-logged category", () => {
    const entries = [entry("ex", "2026-09-01"), entry("rd", "2026-09-01"), entry("rd", "2026-09-01")];
    const cells = shadeDays(entries, [exercise, reading], null);
    expect(cells.get("2026-09-01")!.color).toBe(reading.color);
    expect(cells.get("2026-09-01")!.value).toBe(3);
  });

  it("breaks colour ties by category order", () => {
    const entries = [entry("rd", "2026-09-01"), entry("ex", "2026-09-01")];
    expect(shadeDays(entries, [exercise, reading], null).get("2026-09-01")!.color).toBe(exercise.color);
  });
});

describe("cellBackground", () => {
  it("uses the empty token for unlogged days", () => {
    expect(cellBackground(undefined)).toBe("var(--cell-empty)");
  });
  it("mixes the category colour for logged days", () => {
    expect(cellBackground({ level: 4, color: "#3b6fd1", value: 1 })).toContain("#3b6fd1 100%");
  });
});
