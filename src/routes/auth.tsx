import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";

import { EzraLogo, EzraMark } from "@/components/ezra/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "الدخول — EZRA" },
      { name: "description", content: "Sign in to talk with EZRA, your personal AI companion." },
      { property: "og:title", content: "الدخول — EZRA" },
      {
        property: "og:description",
        content: "Sign in to talk with EZRA, your personal AI companion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function GoogleLogo() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/home", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void navigate({ to: "/home", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: name ? { full_name: name } : {},
          },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("Invalid login")
          ? "الإيميل أو كلمة السر غالطين."
          : message || "ما قدرناش ندخلوك. جرّب مرة أخرى.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("ما قدرناش نكمّلو الدخول. جرّب مرة أخرى.");
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center overflow-hidden px-6 py-10">
      <div className="bg-aura pointer-events-none absolute -top-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full blur-3xl animate-aura" />
      <div className="relative flex flex-col items-center gap-3 animate-fade-up">
        <EzraMark className="size-16" />
        <EzraLogo className="text-4xl" />
        <p className="text-sm text-muted-foreground">رفيقك الشخصي اللي يسمعك فعلاً</p>
      </div>

      <section className="surface-luxe relative mt-10 rounded-3xl p-6 animate-fade-up">
        {sent ? (
          <div className="space-y-3 text-center">
            <h1 className="text-lg font-semibold">تفقّد بريدك</h1>
            <p className="text-sm leading-7 text-muted-foreground">
              بعثنالك رابط تأكيد على {email}. افتحو وبعدها ترجع هنا.
            </p>
            <Button variant="ghost" onClick={() => setSent(false)}>
              رجوع
            </Button>
          </div>
        ) : (
          <>
            <h1 className="mb-5 text-center text-lg font-semibold">
              {mode === "signin" ? "مرحبا بك من جديد" : "حساب جديد"}
            </h1>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => oauth("google")}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-google-border bg-google px-3 text-sm font-medium text-google-foreground"
              >
                <GoogleLogo />
                المتابعة باستخدام Google
              </button>
              <button
                type="button"
                className="lovable-auth-button w-full"
                onClick={() => oauth("lovable")}
              >
                المتابعة باستخدام Lovable
              </button>
            </div>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              أو بالإيميل
              <span className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">اسمك</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="h-11 rounded-xl"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">الإيميل</Label>
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">كلمة السر</Label>
                <Input
                  id="password"
                  type="password"
                  dir="ltr"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className="h-11 rounded-xl"
                />
              </div>
              <Button type="submit" variant="glow" size="lg" className="w-full" disabled={busy}>
                {busy ? "لحظة…" : mode === "signin" ? "دخول" : "إنشاء الحساب"}
              </Button>
            </form>
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-rose-soft"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "ما عندكش حساب؟ سجّل" : "عندك حساب؟ ادخل"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}