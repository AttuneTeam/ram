import { initials } from "./people";

describe("initials", () => {
  it("uses the first and last word", () => {
    expect(initials("Raul Carrizo")).toBe("RC");
    expect(initials("Raul Felix Carrizo")).toBe("RC");
  });

  it("uses two letters of a single name", () => {
    expect(initials("raul")).toBe("RA");
    expect(initials("Al")).toBe("AL");
    expect(initials("J")).toBe("J");
  });

  it("ignores extra whitespace", () => {
    expect(initials("  ana   de  souza ")).toBe("AS");
  });

  it("handles accents and non-Latin scripts", () => {
    expect(initials("Élodie Ōta")).toBe("ÉŌ");
    expect(initials("李 小龙")).toBe("李小");
  });

  it("never returns empty", () => {
    expect(initials("   ")).toBe("?");
  });
});
