import { CreateWorkspaceForm } from "@/components/CreateWorkspaceForm";
import { RecentWorkspaces } from "@/components/RecentWorkspaces";

// A deterministic sample so the hero looks the same on server and client.
function sampleLevel(col: number, row: number) {
  const n = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
  const r = n - Math.floor(n);
  const ramp = col / 26; // busier toward "today"
  if (r > 0.35 + ramp * 0.45) return 0;
  return 1 + Math.floor((r * 7 + ramp * 3) % 4);
}

const MIX = [0, 30, 52, 76, 100];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-8 pb-16 sm:px-8 sm:pt-12 sm:pb-24">
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
        A year of small things, one square at a time.
      </h1>
      <p className="mt-4 max-w-lg text-muted-foreground">
        Log what you did each day — a workout, a chapter, a walk. Each habit gets a colour; the more you do,
        the darker the square. No account needed: you get a private link, and an optional PIN.
      </p>

      <div className="mt-10 overflow-hidden" aria-hidden>
        <div className="flex gap-1">
          {Array.from({ length: 26 }, (_, col) => (
            <div key={col} className="flex flex-col gap-1">
              {Array.from({ length: 7 }, (_, row) => {
                const level = sampleLevel(col, row);
                return (
                  <span
                    key={row}
                    className="size-3.5 rounded-[3px] sm:size-4"
                    style={{
                      background: level
                        ? `color-mix(in oklab, ${row % 3 === 0 ? "#c8701c" : "#3b6fd1"} ${MIX[level]}%, var(--cell-empty))`
                        : "var(--cell-empty)",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <section className="mt-12 rounded-2xl bg-popover p-6 dark:bg-card sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Start a workspace</h2>
        <CreateWorkspaceForm />
      </section>

      <RecentWorkspaces />
    </main>
  );
}
