import { ChatClient } from "@/components/ai/chat-client";

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Ask plain-English questions about your portfolio.
        </p>
      </div>
      <ChatClient />
    </div>
  );
}
