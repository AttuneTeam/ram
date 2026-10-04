import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid flex-1 place-items-center px-4 pb-(--header-h) text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nothing here</h1>
        <p className="mt-1 text-sm text-muted-foreground">Check the link — workspace addresses are case-sensitive.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline">
          Start a new workspace
        </Link>
      </div>
    </main>
  );
}
