import "server-only";
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import zlib from "node:zlib";
import { parseMeta, youtubeId, type LinkMeta } from "./links";

/**
 * Link previews are fetched by our server, from a URL anyone with the edit
 * link can type. So the fetch must never reach anything that isn't the public
 * web: no localhost, no private ranges, no cloud metadata endpoint. The check
 * runs inside the socket's DNS lookup, on the address actually connected to,
 * so a hostname can't pass the check and then re-resolve somewhere private.
 */

const TIMEOUT_MS = 5000;
/** The <head> is near the top; there's no need to read a whole page. */
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 4;

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96], // NAT64 can reach private IPv4
  ["100::", 64],
  ["2001:db8::", 32],
  ["2002::", 16], // 6to4 can embed private IPv4
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/**
 * True only for addresses on the public internet. BlockList also applies the
 * IPv4 rules to IPv4-mapped IPv6 (::ffff:127.0.0.1, ::ffff:7f00:1).
 */
export function isPublicAddress(ip: string): boolean {
  const addr = ip.replace(/^\[|\]$/g, "");
  const family = isIP(addr);
  if (family === 0) return false;
  return !blocked.check(addr, family === 4 ? "ipv4" : "ipv6");
}

class BlockedAddress extends Error {}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** dns.lookup that refuses to hand the socket a non-public address. */
export function publicOnlyLookup(hostname: string, options: LookupOptions, callback: LookupCallback) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
      return callback(new BlockedAddress(`${hostname} is not a public address`), []);
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}

type Fetched = { url: URL; contentType: string; body: Buffer };

function allowed(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  // Web ports only, so this can't be used to probe other services.
  if (url.port !== "" && url.port !== "80" && url.port !== "443") return false;
  // An IP literal skips DNS, so check it here as well.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  return isIP(host) === 0 || isPublicAddress(host);
}

function getOnce(url: URL, signal: AbortSignal): Promise<{ status: number; location?: string } | Fetched> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.get(
      url,
      {
        signal,
        lookup: publicOnlyLookup as never,
        headers: {
          // Plenty of sites only serve Open Graph tags to link-preview bots.
          "user-agent": "Mozilla/5.0 (compatible; RamLinkPreview/1.0; +https://github.com/AttuneTeam/ram)",
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location });
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return resolve({ status });
        }
        const contentType = String(res.headers["content-type"] ?? "").toLowerCase();
        if (!contentType.includes("html")) {
          res.destroy();
          return resolve({ url, contentType, body: Buffer.alloc(0) });
        }

        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          encoding === "gzip" ? res.pipe(zlib.createGunzip())
          : encoding === "deflate" ? res.pipe(zlib.createInflate())
          : encoding === "br" ? res.pipe(zlib.createBrotliDecompress())
          : res;

        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve({ url, contentType, body: Buffer.concat(chunks) });
        };
        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
          if (size >= MAX_BYTES) {
            // Keep what we have: the <head> is in there.
            finish();
            res.destroy();
            if (stream !== res) stream.destroy();
          }
        });
        stream.on("end", finish);
        stream.on("error", (err) => (size > 0 ? finish() : reject(err)));
      },
    );
    req.on("error", reject);
  });
}

async function fetchPublic(start: string): Promise<Fetched | null> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = new URL(start);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (!allowed(url)) return null;
    const res = await getOnce(url, signal);
    if ("body" in res) return res;
    if (!res.location) return null;
    // Every hop is checked again, so a public page can't redirect inward.
    url = new URL(res.location, url);
  }
  return null;
}

function decode(body: Buffer, contentType: string): string {
  const head = body.subarray(0, 2048).toString("latin1");
  const charset =
    contentType.match(/charset=["']?([\w-]+)/)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

const EMPTY: LinkMeta = { title: null, description: null, imageUrl: null, siteName: null, kind: "page" };

/** YouTube's official oEmbed endpoint: a fixed host, so no SSRF concern. */
async function youtubeMeta(url: string, id: string): Promise<LinkMeta> {
  const meta: LinkMeta = {
    ...EMPTY,
    kind: "video",
    siteName: "YouTube",
    // Exists for every public video, whatever oEmbed says.
    imageUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return meta;
    const data = (await res.json()) as { title?: unknown; author_name?: unknown };
    if (typeof data.title === "string") meta.title = data.title.slice(0, 300) || null;
    // The channel reads better than YouTube's boilerplate description.
    if (typeof data.author_name === "string") meta.description = data.author_name.slice(0, 500) || null;
  } catch {
    // Private or deleted video, or YouTube is slow: keep the thumbnail-only preview.
  }
  return meta;
}

/**
 * Preview metadata for a normalised URL. Never throws: a page that can't be
 * previewed still gets saved, it just shows its address.
 */
export async function fetchLinkMeta(url: string): Promise<LinkMeta> {
  const parsed = new URL(url);
  const video = youtubeId(parsed);
  if (video) return youtubeMeta(url, video);

  try {
    const res = await fetchPublic(url);
    if (!res) return EMPTY;
    if (res.contentType.startsWith("image/")) {
      return { ...EMPTY, imageUrl: res.url.protocol === "https:" ? res.url.href : null };
    }
    if (res.body.length === 0) return EMPTY;
    return parseMeta(decode(res.body, res.contentType), res.url.href);
  } catch {
    return EMPTY;
  }
}
