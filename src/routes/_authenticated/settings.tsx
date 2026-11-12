import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Cpu, FolderOpen, Heart, LogOut, Smartphone, AudioLines } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { BottomNav } from "@/components/ezra/BottomNav";
import { EzraMark } from "@/components/ezra/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, updateProfile, type ProfileInput } from "@/lib/profile.functions";
import { cn } from "@/lib/utils";

const profileQuery = () => queryOptions({ queryKey: ["profile"], queryFn: () => getProfile() });

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — EZRA" },
      {
        name: "description",
        content: "Shape EZRA's personality and tell it how you'd like to be addressed.",
      },
      { property: "og:title", content: "الإعدادات — EZRA" },
      {
        property: "og:description",
        content: "Shape EZRA's personality and tell it how you'd like to be addressed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery()),
  component: SettingsPage,
});

const STYLES: Array<{ value: ProfileInput["communication_style"]; label: string; hint: string }> = [
  { value: "balanced", label: "متوازن", hint: "دافي وضحوك" },
  { value: "playful", label: "مرِح", hint: "مزاح وتنمّر لطيف" },
  { value: "calm", label: "هادي", hint: "ناعم ومطمئن" },
  { value: "academic", label: "أكاديمي", hint: "دقيق ومنظّم" },
];

function Section({
  icon,
  title,
  children,
  soon,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  soon?: string;
}) {
  return (
    <section className="surface-luxe rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-wine-gradient text-rose-soft [&_svg]:size-5">
          {icon}
        </span>
        <h2 className="flex-1 text-base font-semibold">{title}</h2>
        {soon && (
          <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
            قريباً
          </span>
        )}
      </div>
      {soon && <p className="mt-3 text-sm leading-6 text-muted-foreground">{soon}</p>}
      {children && <div className="mt-5 space-y-5">{children}</div>}
    </section>
  );
}

function SettingsPage() {
  const { data: profile } = useSuspenseQuery(profileQuery());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const save = useServerFn(updateProfile);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileInput>({
    display_name: profile.display_name ?? "",
    nickname: profile.nickname ?? "",
    profession: profile.profession ?? "",
    lifestyle: profile.lifestyle ?? "",
    about: profile.about ?? "",
    instructions: profile.instructions ?? "",
    humor_level: profile.humor_level,
    affection_level: profile.affection_level,
    communication_style: profile.communication_style as ProfileInput["communication_style"],
  });
  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    setSaving(true);
    try {
      await save({ data: form });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("تحفظ. عزرا رح يتذكّر هاد الشي.");
    } catch {
      toast.error("ما قدرناش نحفظو. جرّب مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col">
      <header className="flex items-center gap-3 px-5 pb-3 pt-[max(env(safe-area-inset-top),16px)]">
        <EzraMark className="size-8" />
        <div className="flex-1">
          <h1 className="font-arabic-display text-2xl">الإعدادات</h1>
          {profile.email && (
            <p dir="ltr" className="text-end text-xs text-muted-foreground">
              {profile.email}
            </p>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
        <Section icon={<Heart />} title="الرفيق الشخصي">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="display_name">اسمك</Label>
              <Input
                id="display_name"
                dir="auto"
                value={form.display_name ?? ""}
                onChange={(e) => set("display_name", e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nickname">كيفاش يناديك عزرا</Label>
              <Input
                id="nickname"
                dir="auto"
                placeholder="مثلاً: حبيبتي، دكتورة…"
                value={form.nickname ?? ""}
                onChange={(e) => set("nickname", e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profession">المهنة أو الدراسة</Label>
            <Input
              id="profession"
              dir="auto"
              placeholder="مثلاً: طالبة طب أسنان، سنة رابعة"
              value={form.profession ?? ""}
              onChange={(e) => set("profession", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lifestyle">نمط الحياة</Label>
            <Input
              id="lifestyle"
              dir="auto"
              placeholder="سهرانة، رياضية، قهوة كثير…"
              value={form.lifestyle ?? ""}
              onChange={(e) => set("lifestyle", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="about">حاجات لازم عزرا يعرفها عليك</Label>
            <Textarea
              id="about"
              dir="auto"
              rows={3}
              value={form.about ?? ""}
              onChange={(e) => set("about", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>أسلوب الحكي</Label>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => set("communication_style", style.value)}
                  className={cn(
                    "rounded-2xl border px-3 py-2.5 text-start transition-colors",
                    form.communication_style === style.value
                      ? "border-rose/60 bg-accent text-foreground"
                      : "border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  <span className="block text-sm font-medium">{style.label}</span>
                  <span className="block text-[11px] opacity-80">{style.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <Label>المزاح</Label>
              <span className="text-rose-soft">{form.humor_level}/10</span>
            </div>
            <Slider
              dir="rtl"
              min={0}
              max={10}
              step={1}
              value={[form.humor_level]}
              onValueChange={([v]) => set("humor_level", v ?? 0)}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <Label>الحنان</Label>
              <span className="text-rose-soft">{form.affection_level}/10</span>
            </div>
            <Slider
              dir="rtl"
              min={0}
              max={10}
              step={1}
              value={[form.affection_level]}
              onValueChange={([v]) => set("affection_level", v ?? 0)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="instructions">تعليمات إضافية لعزرا</Label>
            <Textarea
              id="instructions"
              dir="auto"
              rows={3}
              placeholder="مثلاً: احكي معايا بالدزيري أكثر، وصحّحلي المصطلحات بالفرنسي."
              value={form.instructions ?? ""}
              onChange={(e) => set("instructions", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button variant="glow" size="lg" className="w-full" onClick={submit} disabled={saving}>
            {saving ? "لحظة…" : "حفظ"}
          </Button>
        </Section>

        <Section
          icon={<Brain />}
          title="الذاكرة"
          soon="ذكريات عزرا عليك: تشوفها، تبحث فيها، تعدّلها ولا تحذفها."
        />
        <Section
          icon={<FolderOpen />}
          title="الملفات والمعرفة"
          soon="ارفع كتب ومحاضرات (PDF، Word، PowerPoint…) وعزرا يدرسها ويولّي يفهم فيها."
        />
        <Section icon={<AudioLines />} title="الصوت" soon="اختيار الصوت، السرعة، النبرة واللهجة." />
        <Section
          icon={<Smartphone />}
          title="التحكم في الهاتف"
          soon="مكالمات، رسائل، خرائط ومنبّهات — بنقرة تأكيد منك."
        />
        <Section
          icon={<Cpu />}
          title="إعدادات الذكاء المتقدمة"
          soon="اختيار النموذج وأسلوب الردود."
        />

        <Button variant="luxe" size="lg" className="w-full text-destructive" onClick={signOut}>
          <LogOut /> تسجيل الخروج
        </Button>
      </div>
      <BottomNav />
    </main>
  );
}