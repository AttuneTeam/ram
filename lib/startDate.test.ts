import { activeEntries, archivedCount, defaultStartDate, newlyArchivedCount } from "./startDate";
import type { Entry } from "./types";

function entry(day: string): Entry {
  return { id: day, categoryId: "c", day, description: "", quantity: null, personId: null, linkId: null, createdAt: day };
}

const entries = ["2026-01-05", "2026-03-10", "2026-06-01"].map(entry);

describe("start date", () => {
  it("defaults to a year back", () => {
    expect(defaultStartDate("2026-10-04")).toBe("2025-10-04");
  });

  it("hides entries before the start date, keeping the start day itself", () => {
    expect(activeEntries(entries, "2026-03-10").map((e) => e.day)).toEqual(["2026-03-10", "2026-06-01"]);
    expect(archivedCount(entries, "2026-03-10")).toBe(1);
  });

  it("shows everything when there's no start date", () => {
    expect(activeEntries(entries, null)).toBe(entries);
    expect(archivedCount(entries, null)).toBe(0);
  });

  it("counts only entries a move newly hides", () => {
    expect(newlyArchivedCount(entries, "2026-03-01", "2026-07-01")).toBe(2); // Jan one already archived
    expect(newlyArchivedCount(entries, null, "2026-02-01")).toBe(1);
    expect(newlyArchivedCount(entries, "2026-03-01", "2026-01-01")).toBe(0); // moving earlier hides nothing
  });
});
