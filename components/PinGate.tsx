"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockIcon } from "lucide-react";
import { unlockWorkspace } from "@/app/w/[slug]/actions";
import { cn } from "@/lib/utils";

export function PinGate({ slug }: { slug: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function submit(pin: string) {
    startTransition(async () => {
      const res = await unlockWorkspace(slug, pin);
      if (res.ok) {
        router.refresh();
        return;
      }
      setError(res.error);
      setDigits(["", "", "", ""]);
      inputs.current[0]?.focus();
    });
  }

  function setDigit(i: number, value: string) {
    const clean = value.replace(/\D/g, "");
    // Pasting "1234" into any box fills them all.
    if (clean.length > 1) {
      const next = clean.slice(0, 4).split("");
      while (next.length < 4) next.push("");
      setDigits(next);
      if (clean.length >= 4) submit(clean.slice(0, 4));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    setError(null);
    if (clean && i < 3) inputs.current[i + 1]?.focus();
    if (next.every((d) => d !== "")) submit(next.join(""));
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-xs text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <LockIcon className="size-5" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Enter PIN</h1>
        <p className="mt-1 text-sm text-muted-foreground">This workspace is locked.</p>
        <div className="mt-6 flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              aria-label={`Digit ${i + 1}`}
              inputMode="numeric"
              autoComplete="off"
              autoFocus={i === 0}
              disabled={pending}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
              }}
              className={cn(
                "size-12 rounded-xl bg-input text-center text-xl font-semibold outline-none transition-shadow focus:ring-2 focus:ring-ring/40 disabled:opacity-60",
                error && "ring-2 ring-destructive/40",
              )}
            />
          ))}
        </div>
        <p className="mt-3 h-5 text-sm text-destructive" role="alert">
          {error}
        </p>
      </div>
    </main>
  );
}
