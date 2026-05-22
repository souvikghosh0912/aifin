import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="text-center">
        <p className="text-6xl font-bold tracking-tight">404</p>
        <p className="mt-2 text-lg font-medium">Page not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
