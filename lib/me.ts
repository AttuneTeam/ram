"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Which person "I" am in a workspace, remembered per device. There are no
 * accounts, so this is a convenience that pre-selects the "Logged by" picker,
 * not an identity: anyone with the edit link can log as anyone.
 */
const key = (slug: string) => `ram:me:${slug}`;
const listeners = new Set<() => void>();

function read(slug: string): string | null {
  try {
    return localStorage.getItem(key(slug));
  } catch {
    return null;
  }
}

export function useMe(slug: string): [string | null, (personId: string | null) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  }, []);
  const me = useSyncExternalStore(subscribe, () => read(slug), () => null);

  const setMe = useCallback(
    (personId: string | null) => {
      try {
        if (personId) localStorage.setItem(key(slug), personId);
        else localStorage.removeItem(key(slug));
      } catch {
        // Storage disabled — the picker just won't be pre-filled next time.
      }
      listeners.forEach((l) => l());
    },
    [slug],
  );

  return [me, setMe];
}
