import { accessToken, generateSlug, hashPin, isValidPin, verifyAccessToken, verifyPin } from "./security";

const SECRET = "x".repeat(32);

describe("generateSlug", () => {
  it("is 14 unambiguous characters and doesn't repeat", () => {
    const slugs = new Set(Array.from({ length: 500 }, () => generateSlug()));
    expect(slugs.size).toBe(500);
    for (const s of slugs) expect(s).toMatch(/^[A-HJ-NP-Za-km-z2-9]{14}$/);
  });
});

describe("PIN hashing", () => {
  it("verifies the right PIN only", () => {
    const hash = hashPin("4821");
    expect(verifyPin("4821", hash)).toBe(true);
    expect(verifyPin("4822", hash)).toBe(false);
  });

  it("salts every hash", () => {
    expect(hashPin("0000")).not.toBe(hashPin("0000"));
  });

  it("rejects malformed stored hashes instead of throwing", () => {
    expect(verifyPin("1234", "garbage")).toBe(false);
  });

  it("only accepts exactly four digits", () => {
    expect(isValidPin("1234")).toBe(true);
    for (const bad of ["123", "12345", "12a4", " 1234", ""]) expect(isValidPin(bad)).toBe(false);
  });
});

describe("access token", () => {
  const hash = hashPin("1234");

  it("round-trips for the same slug and PIN", () => {
    const token = accessToken("abcDEF234567gh", hash, SECRET);
    expect(verifyAccessToken(token, "abcDEF234567gh", hash, SECRET)).toBe(true);
  });

  it("is invalidated when the PIN changes", () => {
    const token = accessToken("abcDEF234567gh", hash, SECRET);
    expect(verifyAccessToken(token, "abcDEF234567gh", hashPin("1234"), SECRET)).toBe(false);
  });

  it("can't be reused on another workspace", () => {
    const token = accessToken("abcDEF234567gh", hash, SECRET);
    expect(verifyAccessToken(token, "zzzDEF234567gh", hash, SECRET)).toBe(false);
  });

  it("rejects missing or forged tokens", () => {
    expect(verifyAccessToken(undefined, "abcDEF234567gh", hash, SECRET)).toBe(false);
    expect(verifyAccessToken("nope", "abcDEF234567gh", hash, SECRET)).toBe(false);
  });
});
