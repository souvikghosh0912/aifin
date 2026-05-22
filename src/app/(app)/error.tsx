"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <div>
          <p className="font-medium">Something went wrong</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred. Try again."}
          </p>
        </div>
        <Button onClick={reset}>Try again</Button>
      </CardContent>
    </Card>
  );
}
