import { Link } from "@tanstack/react-router";
import { MessageCircle, Orbit, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { to: "/home", label: "عزرا", icon: Orbit },
  { to: "/chat", label: "المحادثة", icon: MessageCircle },
  { to: "/settings", label: "الإعدادات", icon: Settings2 },
] as const;

export function BottomNav({ className }: { className?: string }) {
  return (
    <nav
      className={cn(
        "surface-luxe mx-4 mb-[max(env(safe-area-inset-bottom),12px)] flex items-center justify-around rounded-full px-2 py-1.5 backdrop-blur-xl",
        className,
      )}
    >
      {items.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[11px] text-muted-foreground transition-colors"
          activeProps={{ className: "text-rose-soft bg-accent/60" }}
        >
          <Icon className="size-5" strokeWidth={1.6} />
          {label}
        </Link>
      ))}
    </nav>
  );
}