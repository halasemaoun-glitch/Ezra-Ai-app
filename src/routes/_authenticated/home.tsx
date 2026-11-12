import { Link, createFileRoute } from "@tanstack/react-router";
import { Mic, MicOff, PhoneOff, Settings2, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BottomNav } from "@/components/ezra/BottomNav";
import { EzraLogo, EzraMark } from "@/components/ezra/Brand";
import { Orb, type OrbState } from "@/components/ezra/Orb";
import { Button } from "@/components/ui/button";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "عزرا — EZRA" },
      {
        name: "description",
        content: "Talk with EZRA by voice. Tap the microphone and just speak.",
      },
      { property: "og:title", content: "عزرا — EZRA" },
      {
        property: "og:description",
        content: "Talk with EZRA by voice. Tap the microphone and just speak.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const LABELS: Record<OrbState, { ar: string; en: string }> = {
  idle: { ar: "اضغط وابدأ الحكي", en: "Tap to talk with Ezra" },
  connecting: { ar: "عزرا جاي…", en: "Connecting" },
  listening: { ar: "عزرا يسمعك", en: "Ezra is Listening" },
  thinking: { ar: "لحظة، أنا نفكّر…", en: "One moment, I'm thinking…" },
  speaking: { ar: "عزرا يحكي", en: "Ezra is Speaking" },
};

function voiceErrorText(message: string) {
  if (/sign in/i.test(message)) return "لازم تعاود تدخل لحسابك باش تحكي مع عزرا.";
  if (/microphone|permission|notallowed/i.test(message))
    return "عزرا يحتاج إذن الميكروفون. فعّلو من إعدادات المتصفح.";
  if (/credit|payment/i.test(message)) return "رصيد الذكاء الاصطناعي خلص.";
  return "الاتصال الصوتي ما نجحش. جرّب مرة أخرى.";
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function HomePage() {
  const online = useOnline();
  const [caption, setCaption] = useState("");
  const [thinking, setThinking] = useState(false);
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [userTalking, setUserTalking] = useState(false);
  const lastInput = useRef(0);
  const lastOutput = useRef(0);
  const awaitingReply = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<{ node: AnalyserNode; stream: MediaStream } | null>(null);

  const onEvent = useCallback((event: LiveEvent) => {
    if (event.type === "session.input_transcript.delta") {
      lastInput.current = Date.now();
      awaitingReply.current = true;
    } else if (event.type === "session.output_transcript.delta") {
      lastOutput.current = Date.now();
      awaitingReply.current = false;
      setThinking(false);
      const delta = typeof event["delta"] === "string" ? event["delta"] : "";
      setCaption(
        (previous) =>
          (Date.now() - lastInput.current < 4000 && previous.length > 220 ? "" : previous) + delta,
      );
    } else if (event.type === "app.delegation.pending") {
      setThinking(true);
    } else if (event.type === "session.commentary.appended") {
      // Deep answer delivered; speaking will follow.
    }
  }, []);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const voice = useLiveVoice({ onEvent, getToken });
  const inCall =
    voice.status === "connecting" || voice.status === "connected" || voice.status === "stopping";

  // Clear the caption when EZRA starts a new reply after the user spoke.
  useEffect(() => {
    if (userTalking) setCaption("");
  }, [userTalking]);

  // Animation loop: speaking level from EZRA's audio, user talking from transcripts.
  useEffect(() => {
    if (voice.status !== "connected") {
      setLevel(0);
      setSpeaking(false);
      setUserTalking(false);
      setThinking(false);
      return;
    }
    let raf = 0;
    let smooth = 0;
    let lastLoud = 0;
    const buffer = new Uint8Array(256);
    const tick = () => {
      const audio = voice.audioRef.current;
      const stream = audio?.srcObject instanceof MediaStream ? audio.srcObject : null;
      const ctx = audioContext.current;
      if (stream && ctx && analyser.current?.stream !== stream) {
        try {
          const node = ctx.createAnalyser();
          node.fftSize = 512;
          ctx.createMediaStreamSource(stream).connect(node);
          analyser.current = { node, stream };
        } catch {
          analyser.current = null;
        }
      }
      let value = 0;
      if (analyser.current) {
        analyser.current.node.getByteTimeDomainData(buffer);
        let sum = 0;
        for (const sample of buffer) sum += ((sample - 128) / 128) ** 2;
        value = Math.min(1, Math.sqrt(sum / buffer.length) * 4);
      }
      smooth = smooth * 0.8 + value * 0.2;
      const now = Date.now();
      if (smooth > 0.05 || now - lastOutput.current < 500) lastLoud = now;
      setLevel(smooth);
      setSpeaking(now - lastLoud < 450);
      setUserTalking(now - lastInput.current < 900);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [voice.status, voice.audioRef]);

  let state: OrbState = "idle";
  if (voice.status === "connecting") state = "connecting";
  else if (voice.status === "connected") {
    if (speaking) state = "speaking";
    else if (thinking || (awaitingReply.current && !userTalking)) state = "thinking";
    else state = "listening";
  }

  function toggleCall() {
    if (inCall) {
      voice.stop();
      return;
    }
    setCaption("");
    try {
      audioContext.current ??= new AudioContext();
      void audioContext.current.resume();
    } catch {
      audioContext.current = null;
    }
    analyser.current = null;
    voice.start();
  }

  const label = LABELS[state];

  return (
    <main className="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden">
      <header className="relative z-10 flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)]">
        <div className="flex items-center gap-2">
          <EzraMark className="size-8" />
          <EzraLogo />
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "size-1.5 rounded-full",
                online ? "bg-online" : "bg-destructive",
                voice.status === "connected" && "animate-status-blink",
              )}
            />
            {!online ? "غير متصل" : voice.status === "connected" ? "على الخط" : "متصل"}
          </span>
          <Button asChild variant="luxe" size="icon" aria-label="الإعدادات">
            <Link to="/settings">
              <Settings2 />
            </Link>
          </Button>
        </div>
      </header>

      <section className="relative flex flex-1 flex-col items-center justify-center px-2">
        <div className="w-[min(104%,460px)]">
          <Orb state={state} level={level} />
        </div>
        <div
          className="-mt-2 flex min-h-[88px] flex-col items-center gap-1 px-6 text-center"
          aria-live="polite"
        >
          <p
            key={state}
            className="font-arabic-display text-2xl text-ivory text-glow animate-fade-up"
          >
            {label.ar}
          </p>
          <p
            dir="ltr"
            className="font-display text-sm tracking-[0.2em] text-rose-soft/80 uppercase"
          >
            {label.en}
          </p>
          {caption && voice.status === "connected" && (
            <p
              dir="auto"
              className="mt-2 line-clamp-2 max-w-xs text-sm leading-6 text-muted-foreground"
            >
              {caption}
            </p>
          )}
          {voice.error && (
            <p role="alert" className="mt-2 max-w-xs text-sm text-destructive">
              {voiceErrorText(voice.error)}
            </p>
          )}
        </div>
      </section>

      <section className="relative z-10 flex items-center justify-center gap-6 pb-5">
        <Button
          variant="luxe"
          size="icon-lg"
          aria-label={voice.muted ? "شغّل الميكروفون" : "اكتم الميكروفون"}
          disabled={voice.status !== "connected"}
          onClick={() => voice.setMuted(!voice.muted)}
          className={cn("transition-opacity", voice.status !== "connected" && "invisible")}
        >
          {voice.muted ? <MicOff /> : <Mic />}
        </Button>
        <div className="relative">
          {!inCall && (
            <span className="absolute inset-0 rounded-full bg-rose/40 blur-xl animate-aura" />
          )}
          <Button
            variant="mic"
            size="mic"
            onClick={toggleCall}
            disabled={voice.status === "stopping"}
            aria-label={inCall ? "إنهاء المكالمة" : "ابدأ الحكي مع عزرا"}
            className="relative [&_svg]:size-8"
          >
            {inCall ? <PhoneOff strokeWidth={1.6} /> : <Mic strokeWidth={1.6} />}
          </Button>
        </div>
        <Button
          variant="luxe"
          size="icon-lg"
          aria-label="شغّل الصوت"
          onClick={voice.resumePlayback}
          className={cn("transition-opacity", !voice.playbackBlocked && "invisible")}
        >
          <Volume2 />
        </Button>
      </section>

      <audio ref={voice.audioRef} controls className="sr-only" />
      <BottomNav />
    </main>
  );
}