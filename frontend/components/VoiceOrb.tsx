"use client";

import { FormEvent, useEffect, useRef } from "react";

type VoiceOrbProps = {
  status: string;
  isSpeaking: boolean;
  listening: boolean;
  transcript: string;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onExit: () => void;
  disabled?: boolean;
};

type Particle = {
  latitude: number;
  longitude: number;
  size: number;
  phase: number;
};

export default function VoiceOrb({
  status,
  isSpeaking,
  listening,
  transcript,
  input,
  onInputChange,
  onSubmit,
  onExit,
  disabled = false,
}: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let frame = 0;
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const particles: Particle[] = Array.from({ length: 330 }, (_, index) => ({
      latitude: Math.acos(1 - 2 * ((index + 0.5) / 330)),
      longitude: Math.PI * (1 + Math.sqrt(5)) * index,
      size: 0.45 + Math.random() * 1.25,
      phase: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = () => {
      frame += isSpeaking ? 0.014 : 0.006;
      context.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width * 0.235, height * 0.31, 150);
      const energy = isSpeaking ? 1 : listening ? 0.72 : 0.48;
      const pulse = 1 + Math.sin(frame * (isSpeaking ? 2.8 : 1.5)) * (isSpeaking ? 0.035 : 0.015);

      const atmosphere = context.createRadialGradient(centerX, centerY, radius * 0.55, centerX, centerY, radius * 2.05);
      atmosphere.addColorStop(0, "rgba(0, 18, 255, 0.02)");
      atmosphere.addColorStop(0.48, `rgba(0, 24, 255, ${0.13 * energy})`);
      atmosphere.addColorStop(0.72, `rgba(0, 0, 255, ${0.22 * energy})`);
      atmosphere.addColorStop(1, "rgba(0, 0, 120, 0)");
      context.fillStyle = atmosphere;
      context.beginPath();
      context.arc(centerX, centerY, radius * 2.1 * pulse, 0, Math.PI * 2);
      context.fill();

      // Three luminous orbital field lines around the sphere.
      for (let ring = 0; ring < 3; ring += 1) {
        context.save();
        context.translate(centerX, centerY);
        context.rotate((-0.22 + ring * 0.21) + frame * (ring % 2 ? -0.035 : 0.025));
        context.beginPath();
        context.ellipse(0, 0, radius * (1.48 + ring * 0.12), radius * (0.49 + ring * 0.055), 0, 0, Math.PI * 2);
        context.strokeStyle = `rgba(26, 45, 255, ${0.22 - ring * 0.045})`;
        context.lineWidth = ring === 0 ? 2.2 : 1.1;
        context.shadowColor = "#142cff";
        context.shadowBlur = 18;
        context.stroke();
        context.restore();
      }

      // Sphere body and its electric-blue rim.
      const sphereGradient = context.createRadialGradient(
        centerX - radius * 0.34,
        centerY - radius * 0.38,
        radius * 0.04,
        centerX,
        centerY,
        radius * 1.08
      );
      sphereGradient.addColorStop(0, "#020817");
      sphereGradient.addColorStop(0.68, "#01030d");
      sphereGradient.addColorStop(0.91, "#02051c");
      sphereGradient.addColorStop(1, "#071bff");
      context.save();
      context.shadowColor = "#071dff";
      context.shadowBlur = isSpeaking ? 46 : 32;
      context.fillStyle = sphereGradient;
      context.beginPath();
      context.arc(centerX, centerY, radius * pulse, 0, Math.PI * 2);
      context.fill();
      context.restore();

      // Dense particles rotate over the visible surface of the globe.
      context.save();
      context.beginPath();
      context.arc(centerX, centerY, radius * 0.985, 0, Math.PI * 2);
      context.clip();
      for (const particle of particles) {
        const longitude = particle.longitude + frame * (isSpeaking ? 0.48 : 0.2);
        const latitude = particle.latitude;
        const x3 = Math.sin(latitude) * Math.cos(longitude);
        const y3 = Math.cos(latitude);
        const z3 = Math.sin(latitude) * Math.sin(longitude);
        const perspective = 0.72 + (z3 + 1) * 0.16;
        const x = centerX + x3 * radius * 0.91;
        const y = centerY + y3 * radius * 0.91;
        const alpha = Math.max(0.08, (z3 + 1) * 0.44) * energy;
        context.beginPath();
        context.fillStyle = `rgba(${isSpeaking ? "35, 112, 255" : "24, 91, 255"}, ${alpha})`;
        context.shadowColor = "#075bff";
        context.shadowBlur = 5;
        context.arc(x, y, particle.size * perspective, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();

      // Small satellites travel around the outside of the globe.
      for (let index = 0; index < 14; index += 1) {
        const angle = frame * (index % 2 ? -0.7 : 0.55) + (Math.PI * 2 * index) / 14;
        const orbitX = Math.cos(angle) * radius * 1.47;
        const orbitY = Math.sin(angle) * radius * 0.52;
        const alpha = 0.3 + (Math.sin(angle * 2) + 1) * 0.32;
        context.beginPath();
        context.fillStyle = `rgba(54, 116, 255, ${alpha})`;
        context.shadowColor = "#1745ff";
        context.shadowBlur = 12;
        context.arc(centerX + orbitX, centerY + orbitY, index % 3 === 0 ? 2.2 : 1.2, 0, Math.PI * 2);
        context.fill();
      }

      context.restore();
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [isSpeaking, listening]);

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_34%,rgba(0,14,110,0.18),transparent_48%)]" />
      <header className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
        <div className="flex items-center gap-2 text-sm font-medium tracking-wide">
          <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_12px_#1745ff]" />
          Nexus AI
        </div>
        <button type="button" onClick={onExit} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/25 hover:text-white">
          Exit microphone mode
        </button>
      </header>

      <section className="relative flex flex-1 flex-col items-center justify-center px-5 pb-5">
        <div className="relative flex h-[min(62vh,560px)] w-full max-w-[760px] items-center justify-center">
          <canvas ref={canvasRef} className="h-full w-full" aria-label="Animated blue Nexus AI particle sphere" />
        </div>
        <div className="-mt-2 text-center">
          <p className="text-sm font-semibold tracking-wide text-white">
            {isSpeaking ? "Nexus is speaking" : status}
          </p>
          <p className="mt-2 min-h-5 max-w-lg text-xs text-zinc-500">
            {transcript || (isSpeaking ? "I'm speaking. You can listen…" : "Say “Hey Nexus” when you're ready.")}
          </p>
        </div>
      </section>

      <footer className="relative z-10 w-full shrink-0 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-8">
        <form onSubmit={onSubmit} className="mx-auto w-full max-w-xl">
          <label htmlFor="nexus-voice-input" className="mb-3 block text-center text-xs font-medium text-zinc-300">
            Ask me anything
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-blue-900/70 bg-[#080a13] p-2 shadow-[0_0_28px_rgba(0,25,255,0.28)] focus-within:border-blue-600/80">
            <input
              id="nexus-voice-input"
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="Type your command here..."
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600"
            />
            <button type="button" onClick={onExit} aria-label="Turn microphone mode off" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-blue-300 transition hover:bg-white/10">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/></svg>
            </button>
            <button type="submit" disabled={!input.trim() || disabled} aria-label="Send command" className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-35">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 14-7-4 14-3-6-7-1Z"/><path d="m12 13 7-8"/></svg>
            </button>
          </div>
          <p className="mt-3 text-center text-[10px] text-zinc-700">Microphone mode · Nexus AI</p>
        </form>
      </footer>
    </main>
  );
}
