import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { History, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { deleteThread, startThread } from "@/lib/chat.functions";
import { threadsQuery } from "@/lib/chat-queries";
import { cn } from "@/lib/utils";

export function ThreadMenu({ activeId }: { activeId: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const threads = useQuery({ ...threadsQuery(), enabled: open });
  const start = useServerFn(startThread);
  const remove = useServerFn(deleteThread);
  const [creating, setCreating] = useState(false);

  async function newThread() {
    setCreating(true);
    try {
      const { id } = await start();
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      await navigate({ to: "/chat/$threadId", params: { threadId: id } });
    } catch {
      toast.error("ما قدرناش نبداو محادثة جديدة.");
    } finally {
      setCreating(false);
    }
  }

  async function removeThread(id: string) {
    try {
      await remove({ data: { threadId: id } });
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      queryClient.removeQueries({ queryKey: ["thread", id] });
      if (id === activeId) await navigate({ to: "/chat", replace: true });
    } catch {
      toast.error("ما قدرناش نحذفو المحادثة.");
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="سجل المحادثات">
            <History className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[86vw] max-w-sm border-border bg-background p-0">
          <SheetHeader className="border-b border-border/60 p-4 text-start">
            <SheetTitle className="font-arabic-display text-xl">المحادثات</SheetTitle>
          </SheetHeader>
          <div className="p-3">
            <Button variant="glow" className="w-full" onClick={newThread} disabled={creating}>
              <Plus /> محادثة جديدة
            </Button>
          </div>
          <ul className="flex max-h-[calc(100dvh-140px)] flex-col gap-1 overflow-y-auto px-3 pb-6">
            {threads.isLoading && <li className="p-3 text-sm text-muted-foreground">لحظة…</li>}
            {threads.data?.map((thread) => (
              <li
                key={thread.id}
                className={cn(
                  "group flex items-center gap-1 rounded-xl border border-transparent transition-colors",
                  thread.id === activeId ? "border-border bg-card" : "hover:bg-muted",
                )}
              >
                <Link
                  to="/chat/$threadId"
                  params={{ threadId: thread.id }}
                  onClick={() => setOpen(false)}
                  className="min-w-0 flex-1 px-3 py-2.5"
                >
                  <p dir="auto" className="truncate text-sm">
                    {thread.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(thread.updated_at), {
                      addSuffix: true,
                      locale: ar,
                    })}
                  </p>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="حذف المحادثة"
                  onClick={() => removeThread(thread.id)}
                  className="me-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
      <Button
        variant="ghost"
        size="icon"
        aria-label="محادثة جديدة"
        onClick={newThread}
        disabled={creating}
      >
        <Plus className="size-5" />
      </Button>
    </div>
  );
}