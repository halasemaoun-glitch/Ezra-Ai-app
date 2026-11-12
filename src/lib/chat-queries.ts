import { queryOptions } from "@tanstack/react-query";

import { getThread, listThreads } from "./chat.functions";

export const threadsQuery = () =>
  queryOptions({ queryKey: ["threads"], queryFn: () => listThreads(), staleTime: 10_000 });

export const threadQuery = (threadId: string) =>
  queryOptions({
    queryKey: ["thread", threadId],
    queryFn: () => getThread({ data: { threadId } }),
    staleTime: Infinity,
  });