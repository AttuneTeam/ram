"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Orientation = "horizontal" | "vertical";

/**
 * How this viewer likes to see the grid. A personal preference, remembered per
 * device and never shared: one person scrolling sideways shouldn't flip it for
 * everyone. Until chosen, phones default to vertical (7 squares fit the width)
 * and wider screens to horizontal.
 */
const KEY = "ram:orientation";
const PHONE = "(max-width: 639px)";
const listeners = new Set<() => void>();
// Used when localStorage is unavailable, so a choice still sticks for this visit.
let chosenThisVisit: Orientation | null = null;

function read(): Orientation {
  if (chosenThisVisit) return chosenThisVisit;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "horizontal" || stored === "vertical") return stored;
  } catch {
    // Storage blocked — fall through to the screen-size default.
  }
  return window.matchMedia(PHONE).matches ? "vertical" : "horizontal";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    mq.removeEventListener("change", onChange);
  };
}

/** Null during server rendering, where the device isn't known. */
export function useOrientation(): [Orientation | null, (o: Orientation) => void] {
  const orientation = useSyncExternalStore(subscribe, read, () => null);
  const set = useCallback((o: Orientation) => {
    chosenThisVisit = o;
    try {
      localStorage.setItem(KEY, o);
    } catch {
      // Not remembered across visits, but applied for this one.
    }
    listeners.forEach((l) => l());
  }, []);
  return [orientation, set];
}
