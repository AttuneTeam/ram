vi.mock("server-only", () => ({}));
import { isPublicAddress, publicOnlyLookup } from "./linkPreview";

describe("isPublicAddress", () => {
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "142.250.70.14", "2606:4700:4700::1111", "[2001:4860:4860::8888]"]) {
      expect(isPublicAddress(ip)).toBe(true);
    }
  });

  it("blocks loopback, private, link-local and cloud metadata addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "255.255.255.255",
      "::1",
      "[::1]",
      "::",
      "fe80::1",
      "fd00::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "::ffff:7f00:1",
      "64:ff9b::7f00:1",
    ]) {
      expect(isPublicAddress(ip)).toBe(false);
    }
  });

  it("rejects things that aren't addresses", () => {
    expect(isPublicAddress("localhost")).toBe(false);
    expect(isPublicAddress("")).toBe(false);
  });
});

describe("publicOnlyLookup", () => {
  const resolve = (host: string, all: boolean) =>
    new Promise<{ err: Error | null; address: unknown }>((done) =>
      publicOnlyLookup(host, { all }, (err, address) => done({ err, address })),
    );

  it("refuses a hostname that resolves to a private address", async () => {
    for (const all of [false, true]) {
      const { err } = await resolve("localhost", all);
      expect(err?.message).toMatch(/not a public address/);
    }
  });
});
