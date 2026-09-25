"use client";

import { useSyncExternalStore } from "react";
import { localToday, type IsoDay } from "./dates";

// Re-check every minute so the grid rolls over at local midnight.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

/**
 * The viewer's local date, or null during server rendering. "Today" depends on
 * the browser's timezone, which the server can't know, so the grid renders
 * only on the client to avoid a hydration mismatch.
 */
export function useToday(): IsoDay | null {
  return useSyncExternalStore(subscribe, () => localToday(), () => null);
}
