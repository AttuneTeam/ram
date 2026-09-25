"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A tooltip for an icon-only control. Shows on hover and keyboard focus, in the
 * same dark style as the grid's day tooltip. The label is also a good
 * `aria-label` for the control, so pass it to both.
 */
export function Hint({
  label,
  side = "bottom",
  children,
}: {
  label: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        side={side}
        sideOffset={6}
        className="bg-foreground text-background shadow-[0px_12px_32px_rgba(56,56,49,0.18)] ring-0"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
