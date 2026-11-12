import { createFileRoute, redirect } from "@tanstack/react-router";

import { latestThread } from "@/lib/chat.functions";

export const Route = createFileRoute("/_authenticated/chat/")({
  loader: async () => {
    const { id } = await latestThread();
    throw redirect({ to: "/chat/$threadId", params: { threadId: id }, replace: true });
  },
});