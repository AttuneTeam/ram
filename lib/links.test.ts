import { buildLibrary, normalizeUrl, parseMeta } from "./links";
import type { Entry, Link } from "./types";

describe("normalizeUrl", () => {
  it("turns every shape of YouTube link into one watch URL", () => {
    const want = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&si=abc",
      "https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?si=xyz",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "youtu.be/dQw4w9WgXcQ",
    ]) {
      expect(normalizeUrl(url)).toBe(want);
    }
  });

  it("adds https to a bare address and drops tracking params and the fragment", () => {
    expect(normalizeUrl("  example.com/workout?utm_source=ig&level=2#top ")).toBe("https://example.com/workout?level=2");
  });

  it("keeps http when it was given", () => {
    expect(normalizeUrl("http://example.com/")).toBe("http://example.com/");
  });

  it("rejects things that aren't plain web links", () => {
    for (const bad of [
      "",
      "not a link",
      "workout",
      "javascript:alert(1)",
      "ftp://example.com/file",
      "data:text/html,hi",
      "https://user:pass@example.com/",
    ]) {
      expect(normalizeUrl(bad)).toBeNull();
    }
  });
});

describe("parseMeta", () => {
  const page = "https://example.com/posts/1";

  it("prefers Open Graph, in either attribute order, and resolves a relative image", () => {
    const html = `<html><head>
      <title>Fallback title</title>
      <meta content="Big &amp; bold" property="og:title">
      <meta property='og:description' content='A 20&#8209;minute flow'>
      <meta property="og:image" content="/img/cover.jpg" />
      <meta property="og:site_name" content="Example">
      <meta property="og:type" content="video.other">
    </head></html>`;
    expect(parseMeta(html, page)).toEqual({
      title: "Big & bold",
      description: "A 20‑minute flow",
      imageUrl: "https://example.com/img/cover.jpg",
      siteName: "Example",
      kind: "video",
    });
  });

  it("falls back to Twitter cards, then <title> and description", () => {
    const html = `<title> Plain
      title </title><meta name="description" content="Just a page"><meta name="twitter:image" content="https://cdn.example.com/a.png">`;
    expect(parseMeta(html, page)).toEqual({
      title: "Plain title",
      description: "Just a page",
      imageUrl: "https://cdn.example.com/a.png",
      siteName: null,
      kind: "page",
    });
  });

  it("drops images that aren't https", () => {
    expect(parseMeta(`<meta property="og:image" content="http://example.com/a.jpg">`, page).imageUrl).toBeNull();
    expect(parseMeta(`<meta property="og:image" content="javascript:alert(1)">`, page).imageUrl).toBeNull();
  });

  it("caps long values", () => {
    const title = parseMeta(`<meta property="og:title" content="${"x".repeat(400)}">`, page).title!;
    expect(title.length).toBe(300);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("buildLibrary", () => {
  const link = (id: string): Link => ({
    id,
    url: `https://example.com/${id}`,
    kind: "page",
    title: id,
    description: null,
    imageUrl: null,
    siteName: null,
  });
  const entry = (id: string, day: string, linkId: string | null): Entry => ({
    id,
    categoryId: "c",
    notes: "",
    day,
    description: "",
    quantity: null,
    personId: null,
    linkId,
    createdAt: `${day}T10:00:00Z`,
  });

  it("groups entries by link, most recently done first, and skips unlinked entries", () => {
    const lib = buildLibrary(
      [
        entry("1", "2026-09-01", "a"),
        entry("2", "2026-09-03", "b"),
        entry("3", "2026-09-05", "a"),
        entry("4", "2026-09-06", null),
        entry("5", "2026-09-07", "gone"),
      ],
      [link("a"), link("b")],
    );
    expect(lib.map((i) => i.link.id)).toEqual(["a", "b"]);
    expect(lib[0].lastDay).toBe("2026-09-05");
    expect(lib[0].entries.map((e) => e.id)).toEqual(["3", "1"]);
  });
});
