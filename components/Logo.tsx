import { cn } from "@/lib/utils";

/**
 * The Ram mark: a ram's head drawn in grid cells — horns in one category
 * colour, face in another. Cells mix against --cell-empty like real ones, so
 * the mark follows the theme. app/icon.svg is the static favicon copy.
 */
const ART = `
..HHHH.....HHHH..
.HHHHHH...HHHHHH.
HHh..HHH.HHH..hHH
HH....FFFFF....HH
HH..eeFFFFFee..HH
HH...FFFFFFF...HH
HHh...FFFFF...hHH
.HHh..FFFFF..hHH.
..hhh.FFFFF.hhh..
....h.FMMMF.h....
.......MMM.......`;

const HORN = "#c8701c";
const FACE = "#3b6fd1";
const SHADE: Record<string, [string, number]> = {
  H: [HORN, 100],
  h: [HORN, 70],
  F: [FACE, 72],
  e: [FACE, 48],
  M: [FACE, 38],
};

const CELLS = ART.trim()
  .split("\n")
  .flatMap((row, y) => [...row].flatMap((c, x) => (SHADE[c] ? [{ x, y, fill: SHADE[c] }] : [])));

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 168 108" aria-hidden className={cn("h-6 w-auto shrink-0", className)}>
      {CELLS.map(({ x, y, fill: [color, mix] }) => (
        <rect
          key={`${x}-${y}`}
          x={x * 10}
          y={y * 10}
          width="8"
          height="8"
          rx="2"
          style={{ fill: `color-mix(in oklab, ${color} ${mix}%, var(--cell-empty))` }}
        />
      ))}
    </svg>
  );
}
