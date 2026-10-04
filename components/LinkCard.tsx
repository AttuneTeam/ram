"use client";

import { useState } from "react";
import { GlobeIcon, PlayIcon } from "lucide-react";
import { hostLabel } from "@/lib/links";
import type { Link } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  link: Link;
  /** "row": a slim line inside an entry. "card": thumbnail beside title, for the dialog and library. */
  variant?: "row" | "card";
  className?: string;
  children?: React.ReactNode;
};

/** A link's preview. Always opens in a new tab, and never sends our URL as the referrer. */
export function LinkCard({ link, variant = "card", className, children }: Props) {
  const title = link.title ?? hostLabel(link.url);
  const source = [link.siteName ?? hostLabel(link.url), link.description && link.kind === "video" ? link.description : null]
    .filter(Boolean)
    .join(" · ");

  if (variant === "row") {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Thumb link={link} className="h-6 w-10.5 rounded-sm" iconClassName="size-2.5" />
        {/* min-w-0: a flex item otherwise refuses to shrink below its text, widening the dialog. */}
        <span className="min-w-0 truncate">{title}</span>
      </a>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-lg bg-well p-2", className)}>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Thumb link={link} className="h-14 w-24 rounded-md" iconClassName="size-4" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm leading-snug">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{source}</span>
        </span>
      </a>
      {children}
    </div>
  );
}

function Thumb({ link, className, iconClassName }: { link: Link; className: string; iconClassName: string }) {
  // A thumbnail can 404 or be hotlink-blocked; fall back to a plain tile.
  const [failed, setFailed] = useState(false);
  const image = !failed && link.imageUrl;
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden bg-muted text-muted-foreground", className)}>
      {image ? (
        // Arbitrary third-party hosts, so next/image's allow-list doesn't fit.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        link.kind !== "video" && <GlobeIcon className={iconClassName} />
      )}
      {link.kind === "video" && (
        <span className="relative grid place-items-center rounded-full bg-black/60 p-1 text-white">
          <PlayIcon className={cn("fill-current", iconClassName)} />
        </span>
      )}
    </span>
  );
}
