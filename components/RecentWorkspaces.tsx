"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { readRecent, type RecentWorkspace } from "@/lib/recent";

// localStorage doesn't notify same-tab writes; the list only changes on navigation anyway.
const noop = () => () => {};
let cache: { raw: string; value: RecentWorkspace[] } | null = null;

function snapshot(): RecentWorkspace[] {
  const value = readRecent();
  const raw = JSON.stringify(value);
  if (!cache || cache.raw !== raw) cache = { raw, value };
  return cache.value;
}

const empty: RecentWorkspace[] = [];

export function RecentWorkspaces() {
  const recent = useSyncExternalStore(noop, snapshot, () => empty);
  if (recent.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-muted-foreground">Opened on this device</h2>
      <ul className="mt-3 space-y-1">
        {recent.map((w) => (
          <li key={w.slug}>
            <Link
              href={`/w/${w.slug}`}
              className="group flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-hover"
            >
              <span className="truncate font-medium">{w.name}</span>
              <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
