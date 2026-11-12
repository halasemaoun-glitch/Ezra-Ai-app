import { useEffect, useRef } from "react";

import orbImage from "@/assets/ezra-orb.jpg";
import { cn } from "@/lib/utils";

export type OrbState = "idle" | "connecting" | "listening" | "thinking" | "speaking";

type Particle = {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  hue: number;
  drift: number;
};

const STATE_SPIN: Record<OrbState, string> = {
  idle: "90s",
  connecting: "30s",
  listening: "60s",
  thinking: "14s",
  speaking: "45s",
};

/** EZRA's mind: a glowing volumetric orb with particles and sound waves per state. */
export function Orb({
  state,
  level = 0,
  className,
}: {
  state: OrbState;
  level?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const levelRef = useRef(level);
  stateRef.current = state;
  levelRef.current = level;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const particles: Particle[] = Array.from({ length: 90 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 0.36 + Math.random() * 0.16,
      speed: (0.0006 + Math.random() * 0.0016) * (Math.random() > 0.5 ? 1 : -1),
      size: 0.6 + Math.random() * 1.8,
      hue: Math.random() > 0.35 ? 355 : 300,
      drift: Math.random() * Math.PI * 2,
    }));
    let frame = 0;
    let raf = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
    };
    resize();
    window.addEventListener("resize", resize);
    const draw = () => {
      frame++;
      const { width, height } = canvas;
      const size = Math.min(width, height);
      const cx = width / 2;
      const cy = height / 2;
      const current = stateRef.current;
      const energy =
        current === "thinking"
          ? 3.2
          : current === "speaking"
            ? 1.6 + levelRef.current * 4
            : current === "listening"
              ? 1.4
              : current === "connecting"
                ? 2.2
                : 1;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      for (const particle of particles) {
        particle.angle += particle.speed * energy;
        const wobble = Math.sin(frame * 0.01 + particle.drift) * 0.025 * energy;
        const r =
          (particle.radius + wobble + (current === "speaking" ? levelRef.current * 0.05 : 0)) *
          size;
        const x = cx + Math.cos(particle.angle) * r;
        const y = cy + Math.sin(particle.angle) * r * 0.92;
        const alpha = 0.25 + 0.55 * Math.abs(Math.sin(frame * 0.02 + particle.drift));
        context.beginPath();
        context.fillStyle = `oklch(0.78 0.16 ${particle.hue} / ${alpha})`;
        context.arc(x, y, particle.size * (size / 420), 0, Math.PI * 2);
        context.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const active = state === "listening" || state === "speaking";

  return (
    <div
      className={cn("relative aspect-square w-full select-none", className)}
      style={{ ["--level" as string]: level.toFixed(3), ["--spin" as string]: STATE_SPIN[state] }}
      aria-hidden
    >
      <div
        className={cn(
          "bg-aura absolute -inset-[12%] rounded-full blur-2xl animate-aura",
          state === "thinking" && "[--pulse:1.6s]",
          state === "speaking" && "[--pulse:2.4s]",
        )}
      />

      {active &&
        [0, 0.8, 1.6].map((delay) => (
          <span
            key={delay}
            className={cn(
              "absolute inset-[14%] rounded-full border",
              state === "speaking"
                ? "animate-ring-out border-rose/50"
                : "animate-ring-in border-rose-soft/40",
            )}
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      {state === "thinking" && (
        <span className="absolute inset-[10%] rounded-full border border-dashed border-violet/50 animate-orb-spin [--spin:9s]" />
      )}

      <div
        className="absolute inset-0 animate-orb-breathe transition-[filter] duration-700"
        style={{
          filter:
            state === "thinking"
              ? "hue-rotate(-28deg) saturate(1.15)"
              : state === "idle"
                ? "brightness(0.82)"
                : "none",
        }}
      >
        <img
          src={orbImage}
          alt=""
          width={1024}
          height={1024}
          className="h-full w-full animate-orb-spin rounded-full object-cover mix-blend-screen [mask-image:radial-gradient(circle,black_58%,transparent_71%)]"
          draggable={false}
        />
      </div>

      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute -inset-[6%] h-[112%] w-[112%]"
      />
    </div>
  );
}