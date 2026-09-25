import { cellBackground, levelFor, MAX_BANDS, percentile, shadeDays } from "./intensity";
import type { Category, Entry } from "./types";

const exercise: Category = { id: "ex", name: "Exercise", color: "#3b6fd1", unit: "min", sortOrder: 0 };
const reading: Category = { id: "rd", name: "Reading", color: "#c8701c", unit: "pages", sortOrder: 1 };

let n = 0;
function entry(categoryId: string, day: string, quantity: number | null = null): Entry {
  return { id: `e${n++}`, categoryId, day, description: "", quantity, personId: null, createdAt: `${day}T00:00:0${n % 10}Z` };
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

describe("shadeDays — one category", () => {
  it("shades by summed quantity — more is darker", () => {
    const entries = [
      entry("ex", "2026-09-01", 10),
      entry("ex", "2026-09-02", 20),
      entry("ex", "2026-09-02", 20),
      entry("rd", "2026-09-03", 100),
    ];
    const cells = shadeDays(entries, [exercise, reading], "ex");
    expect(cells.get("2026-09-01")!.level).toBeLessThan(cells.get("2026-09-02")!.level);
    expect(cells.has("2026-09-03")).toBe(false); // other category ignored
    expect(cells.get("2026-09-01")!.bands).toHaveLength(1);
    expect(cells.get("2026-09-01")!.bands[0].color).toBe(exercise.color);
  });

  it("falls back to entry count when a category has no quantities", () => {
    const entries = [entry("rd", "2026-09-01"), entry("rd", "2026-09-02"), entry("rd", "2026-09-02")];
    const cells = shadeDays(entries, [exercise, reading], "rd");
    expect(cells.get("2026-09-01")!.level).toBeLessThan(cells.get("2026-09-02")!.level);
  });
});

describe("shadeDays — all categories", () => {
  it("gives each category done that day its own band", () => {
    const entries = [entry("ex", "2026-09-01", 30), entry("rd", "2026-09-01", 10)];
    const bands = shadeDays(entries, [exercise, reading], null).get("2026-09-01")!.bands;
    expect(bands.map((b) => b.categoryId)).toEqual(["ex", "rd"]);
  });

  it("orders bands by category order, not by what was logged first", () => {
    const entries = [entry("rd", "2026-09-01"), entry("ex", "2026-09-01")];
    const bands = shadeDays(entries, [reading, exercise], null).get("2026-09-01")!.bands;
    expect(bands.map((b) => b.categoryId)).toEqual(["ex", "rd"]);
  });

  it("scales each category on its own, so pages don't swamp minutes", () => {
    const entries = [
      entry("ex", "2026-09-01", 30), // exercise's biggest day
      entry("ex", "2026-09-02", 10),
      entry("rd", "2026-09-01", 5), // reading's smallest day
      entry("rd", "2026-09-02", 400),
    ];
    const cells = shadeDays(entries, [exercise, reading], null);
    const [ex1, rd1] = cells.get("2026-09-01")!.bands;
    expect(ex1.level).toBe(4);
    expect(rd1.level).toBe(1);
  });

  it("caps the number of bands", () => {
    const many: Category[] = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`, name: `C${i}`, color: "#3b6fd1", unit: null, sortOrder: i,
    }));
    const entries = many.map((c) => entry(c.id, "2026-09-01"));
    const bands = shadeDays(entries, many, null).get("2026-09-01")!.bands;
    expect(bands).toHaveLength(MAX_BANDS);
    expect(bands.map((b) => b.categoryId)).toEqual(["c0", "c1", "c2", "c3"]);
  });
});

describe("cellBackground", () => {
  it("uses the empty token for unlogged days", () => {
    expect(cellBackground(undefined)).toBe("var(--cell-empty)");
  });

  it("is a flat shade for one category", () => {
    const bg = cellBackground({ level: 4, bands: [{ categoryId: "ex", color: "#3b6fd1", level: 4 }] });
    expect(bg).toBe("color-mix(in oklab, #3b6fd1 100%, var(--cell-empty))");
  });

  it("splits into equal hard-edged bands for several", () => {
    const bg = cellBackground({
      level: 4,
      bands: [
        { categoryId: "ex", color: "#3b6fd1", level: 4 },
        { categoryId: "rd", color: "#c8701c", level: 1 },
      ],
    });
    expect(bg).toMatch(/^linear-gradient\(90deg, /);
    expect(bg).toContain("#3b6fd1 100%, var(--cell-empty)) 0.00% 50.00%");
    expect(bg).toContain("#c8701c 30%, var(--cell-empty)) 50.00% 100.00%");
  });
});
