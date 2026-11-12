import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { Orbit } from "lucide-react";

import { ChatWindow } from "@/components/ezra/ChatWindow";
import { ThreadMenu } from "@/components/ezra/ThreadMenu";
import { Button } from "@/components/ui/button";
import { threadQuery } from "@/lib/chat-queries";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  loader: async ({ context, params }) => {
    const thread = await context.queryClient.ensureQueryData(threadQuery(params.threadId));
    if (!thread) throw notFound();
  },
  notFoundComponent: () => (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-muted-foreground">هاد المحادثة ما كاينش.</p>
      <Button asChild variant="glow">
        <Link to="/chat">محادثة جديدة</Link>
      </Button>
    </div>
  ),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { data: thread } = useSuspenseQuery(threadQuery(threadId));
  if (!thread) return null;

  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col">
      <header className="flex items-center gap-2 border-b border-border/60 px-3 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
        <ThreadMenu activeId={threadId} />
        <h1
          dir="auto"
          className="min-w-0 flex-1 truncate text-center text-sm font-medium text-foreground/90"
        >
          {thread.title}
        </h1>
        <Button asChild variant="ghost" size="icon" aria-label="رجوع لعزرا">
          <Link to="/home">
            <Orbit className="size-5" />
          </Link>
        </Button>
      </header>
      <ChatWindow
        key={threadId}
        threadId={threadId}
        initialMessages={thread.messages as UIMessage[]}
      />
    </main>
  );
}