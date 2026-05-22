"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
          <div className="max-w-md text-center">
            <p className="text-2xl font-bold">Something went wrong</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {error.message || "An unexpected error occurred."}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={reset}>Try again</Button>
              <Button variant="outline" asChild>
                <Link href="/">Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
