import type { IsoDay } from "./dates";
import type { Entry, Link } from "./types";

/** Query parameters that only track where a link was shared from. */
const TRACKING_PARAMS = /^(utm_\w+|fbclid|gclid|mc_cid|mc_eid|igshid|si|feature|ref_src)$/i;

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** The video id of a YouTube watch, short, shorts, embed or live link; null otherwise. */
export function youtubeId(url: URL): string | null {
  if (!YOUTUBE_HOSTS.has(url.hostname)) return null;
  let id: string | null = null;
  if (url.hostname === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (url.pathname === "/watch") id = url.searchParams.get("v");
  else {
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
    id = m?.[1] ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/**
 * The canonical form a link is stored under, so the same video or page pasted
 * twice (from the app, a share sheet, a phone) becomes one library item.
 * Accepts a bare "example.com/x" too. Returns null for anything that isn't a
 * plain http(s) web address.
 */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (raw === "" || raw.length > 2048 || /\s/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  // A host needs a dot (or is an IP); "https://workout" is almost certainly a typo.
  if (!url.hostname.includes(".") && !url.hostname.includes(":")) return null;

  const video = youtubeId(url);
  if (video) return `https://www.youtube.com/watch?v=${video}`;

  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  const out = url.toString();
  return out.length <= 2048 ? out : null;
}

export type LinkMeta = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  kind: "video" | "page";
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function clean(s: string | undefined, max: number): string | null {
  if (!s) return null;
  const v = decodeEntities(s).replace(/\s+/g, " ").trim();
  if (v === "") return null;
  return v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v;
}

/** Only https images: http ones would be blocked as mixed content anyway. */
function imageUrl(src: string | undefined, base: string): string | null {
  if (!src) return null;
  try {
    const url = new URL(decodeEntities(src.trim()), base);
    return url.protocol === "https:" && url.href.length <= 2048 ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Preview metadata from a page's <head>: Open Graph first, then Twitter cards,
 * then plain <title> / description. A regex scan, not a DOM: we only ever read
 * a capped prefix of the page, and only these few tags.
 */
export function parseMeta(html: string, pageUrl: string): LinkMeta {
  const meta = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = new Map<string, string>();
    for (const [, name, , dq, sq, bare] of tag.matchAll(/([a-z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
      attrs.set(name.toLowerCase(), dq ?? sq ?? bare ?? "");
    }
    const key = (attrs.get("property") ?? attrs.get("name"))?.toLowerCase();
    const content = attrs.get("content");
    if (key && content !== undefined && !meta.has(key)) meta.set(key, content);
  }
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const type = meta.get("og:type") ?? "";
  return {
    title: clean(meta.get("og:title") ?? meta.get("twitter:title") ?? title, 300),
    description: clean(meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"), 500),
    imageUrl: imageUrl(meta.get("og:image:secure_url") ?? meta.get("og:image") ?? meta.get("twitter:image"), pageUrl),
    siteName: clean(meta.get("og:site_name"), 100),
    kind: type.startsWith("video") ? "video" : "page",
  };
}

/** "youtube.com" for display when a site gives no name of its own. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export type LibraryItem = {
  link: Link;
  /** Newest first. */
  entries: Entry[];
  lastDay: IsoDay;
};

/** Every link that's been logged at least once, most recently done first. */
export function buildLibrary(entries: Entry[], links: Link[]): LibraryItem[] {
  const byId = new Map(links.map((l) => [l.id, l]));
  const items = new Map<string, LibraryItem>();
  for (const e of entries) {
    const link = e.linkId ? byId.get(e.linkId) : undefined;
    if (!link) continue;
    const item = items.get(link.id) ?? { link, entries: [], lastDay: e.day };
    item.entries.push(e);
    if (e.day > item.lastDay) item.lastDay = e.day;
    items.set(link.id, item);
  }
  for (const item of items.values()) {
    item.entries.sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt));
  }
  return [...items.values()].sort(
    (a, b) => b.lastDay.localeCompare(a.lastDay) || b.entries[0].createdAt.localeCompare(a.entries[0].createdAt),
  );
}
