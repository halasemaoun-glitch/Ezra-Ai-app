import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { EzraLogo, EzraMark } from "@/components/ezra/Brand";
import { Orb } from "@/components/ezra/Orb";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EZRA — رفيقك الشخصي الذكي" },
      {
        name: "description",
        content:
          "Talk to EZRA by voice or chat: a warm, witty AI companion and dental study partner.",
      },
      { property: "og:title", content: "EZRA — رفيقك الشخصي الذكي" },
      {
        property: "og:description",
        content:
          "Talk to EZRA by voice or chat: a warm, witty AI companion and dental study partner.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center justify-between overflow-hidden px-6 pb-12 pt-10">
      <header className="flex items-center gap-2 animate-fade-up">
        <EzraMark className="size-8" />
        <EzraLogo />
      </header>
      <div className="w-[88%] animate-fade-up">
        <Orb state="idle" />
      </div>
      <div className="w-full space-y-6 text-center animate-fade-up">
        <div className="space-y-2">
          <h1 className="font-arabic-display text-3xl leading-snug">احكيلي، أنا هنا</h1>
          <p className="text-sm leading-7 text-muted-foreground">
            رفيق دافي، ضحوك، ويفهم في طب الأسنان أكثر من أستاذك 😉
          </p>
        </div>
        <Button asChild variant="glow" size="lg" className="w-full">
          <Link to="/auth">ادخل إلى عزرا</Link>
        </Button>
      </div>
    </main>
  );
}