"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { AiStubBanner } from "@/components/ai/ai-stub-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SAMPLE_PROMPTS = [
  "What's my best-performing holding?",
  "Summarize this month's activity",
  "Which positions am I most concentrated in?",
  "How did my portfolio do today?",
];

export function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  const send = async (text: string) => {
    if (!text.trim() || pending) return;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "AI service unavailable");
      }
      const data = (await res.json()) as { reply: string };
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "AI isn't configured yet. Set ANTHROPIC_API_KEY in .env.local and implement src/lib/ai/provider.ts to enable replies.",
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <AiStubBanner
        title="Chat with your portfolio"
        description="Ask plain-English questions about your holdings and transactions. Replies stream once an AI provider is configured."
      />

      <Card className="flex h-[60vh] flex-col">
        <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="m-auto flex max-w-md flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                Try one of these to see how it&apos;ll work:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-full border bg-card px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {m.content}
              </div>
            ))
          )}
        </CardContent>
        <div className="border-t p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your portfolio…"
              disabled={pending}
            />
            <Button type="submit" disabled={pending || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
