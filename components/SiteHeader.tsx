import Link from "next/link";
import { Logo } from "@/components/Logo";

/** The bar across the top of every page. Its height is --header-h in globals.css. */
export function SiteHeader() {
  return (
    <header className="flex h-(--header-h) shrink-0 items-center px-4 sm:px-8">
      <Link
        href="/"
        className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-sm font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Logo className="h-6" />
        Ram
      </Link>
    </header>
  );
}
