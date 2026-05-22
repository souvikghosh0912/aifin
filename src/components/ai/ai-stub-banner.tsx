import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AiStubBanner({
  title = "AI features are ready to wire up",
  description = "The UI, database tables, and provider seam are scaffolded. Set ANTHROPIC_API_KEY in .env.local and implement src/lib/ai/provider.ts to bring this to life.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card className="border-dashed bg-muted/40">
      <CardContent className="flex flex-col items-start gap-3 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-background text-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">{title}</p>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <a
            href="https://docs.anthropic.com/en/api/getting-started"
            target="_blank"
            rel="noreferrer"
          >
            Setup guide
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
