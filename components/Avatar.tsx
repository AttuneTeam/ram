import { initials } from "@/lib/people";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Initials in a neutral circle. Deliberately colourless: colour on the grid
 * means "category", so people are told apart by their initials, not a hue.
 */
export function Avatar({
  person,
  size = "md",
  title = person.name,
  className,
}: {
  person: Pick<Person, "name">;
  size?: "xs" | "sm" | "md";
  /** Hover text; pass null when a surrounding control has its own. */
  title?: string | null;
  className?: string;
}) {
  return (
    <span
      title={title ?? undefined}
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full bg-secondary font-semibold tracking-tight text-secondary-foreground select-none",
        size === "xs" && "size-4 text-[8px]",
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-xs",
        className,
      )}
    >
      {initials(person.name)}
    </span>
  );
}
