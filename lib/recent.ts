/**
 * Workspaces this browser has opened, so the home page can link back to them.
 * A convenience only: the link itself is the real key, and this list can be
 * wiped by the browser at any time.
 */
export type RecentWorkspace = { slug: string; name: string; visitedAt: number };

const KEY = "ram:recent";

export function readRecent(): RecentWorkspace[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rememberWorkspace(slug: string, name: string) {
  try {
    const rest = readRecent().filter((w) => w.slug !== slug);
    const next = [{ slug, name, visitedAt: Date.now() }, ...rest].slice(0, 10);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage disabled — nothing to remember.
  }
}

export function forgetWorkspace(slug: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(readRecent().filter((w) => w.slug !== slug)));
  } catch {
    // ignore
  }
}
