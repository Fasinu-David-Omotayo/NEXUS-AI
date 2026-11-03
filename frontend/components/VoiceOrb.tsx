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
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
  phase: number;
};

const PARTICLE_COUNT = 460;

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
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let rotation = 0;
    let disposed = false;

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      return {
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.cos(phi),
        z: Math.sin(phi) * Math.sin(theta),
        size: 0.45 + Math.random() * 1.2,
        speed: 0.75 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
      };
    });

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      if (disposed) return;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width * 0.205, height * 0.31, 116);
      const energy = isSpeaking ? 1 : listening ? 0.78 : 0.58;
      rotation += isSpeaking ? 0.011 : 0.005;

      // Soft blue field around the globe, inspired by the reference's layered glow.
      const field = ctx.createRadialGradient(cx, cy, radius * 0.72, cx, cy, radius * 2.0);
      field.addColorStop(0, "rgba(0, 0, 255, 0)");
      field.addColorStop(0.43, `rgba(0, 0, 255, ${0.11 * energy})`);
      field.addColorStop(0.66, `rgba(15, 0, 255, ${0.24 * energy})`);
      field.addColorStop(0.82, `rgba(15, 0, 255, ${0.11 * energy})`);
      field.addColorStop(1, "rgba(0, 0, 100, 0)");
      ctx.fillStyle = field;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2, 0, Math.PI * 2);
      ctx.fill();

      // The sphere is intentionally dark; only its blue particles define its surface.
      ctx.save();
      ctx.fillStyle = "#010208";
      ctx.shadowColor = "#1900ff";
      ctx.shadowBlur = isSpeaking ? 34 : 22;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.99, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const projected = particles.map((particle) => {
        const x = particle.x * cos - particle.z * sin;
        const z = particle.x * sin + particle.z * cos;
        const perspective = 0.76 + (z + 1) * 0.12;
        const shimmer = 0.82 + Math.sin(rotation * particle.speed + particle.phase) * 0.18;
        return {
          x: cx + x * radius * 0.9,
          y: cy + particle.y * radius * 0.9,
          z,
          size: particle.size * perspective,
          alpha: Math.max(0.07, (0.2 + (z + 1) * 0.35) * shimmer * energy),
        };
      }).sort((a, b) => a.z - b.z);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.98, 0, Math.PI * 2);
      ctx.clip();
      for (const particle of projected) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(0, ${isSpeaking ? 108 : 86}, 255, ${particle.alpha})`;
        ctx.shadowColor = "#0750ff";
        ctx.shadowBlur = particle.z > 0 ? 6 : 1;
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Tiny orbiting points travel around the outside of the globe.
      ctx.save();
      for (let index = 0; index < 22; index += 1) {
        const angle = rotation * (index % 2 ? -1.6 : 1.35) + index * (Math.PI * 2 / 22);
        const x = cx + Math.cos(angle) * radius * 1.47;
        const y = cy + Math.sin(angle) * radius * 0.52;
        ctx.beginPath();
        ctx.fillStyle = `rgba(45, 85, 255, ${(0.2 + (Math.sin(angle * 1.7) + 1) * 0.2) * energy})`;
        ctx.shadowColor = "#1900ff";
        ctx.shadowBlur = 9;
        ctx.arc(x, y, index % 4 === 0 ? 1.7 : 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      raf = window.requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    raf = window.requestAnimationFrame(draw);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [isSpeaking, listening]);

  return (
    <main className="jarvis-voice">
      <style jsx global>{`
        .jarvis-voice{position:relative;display:flex;width:100%;height:100dvh;min-height:480px;flex-direction:column;overflow:hidden;background:#000;color:#fff}
        .jarvis-voice__stage{position:relative;display:flex;flex:1;min-height:0;flex-direction:column;align-items:center;justify-content:center;padding:8px 16px 0}
        .jarvis-voice__visual{position:relative;display:flex;width:min(400px,88vw);height:min(400px,55vh);align-items:center;justify-content:center;isolation:isolate}
        .jarvis-voice__visual .square{position:relative;width:min(100%,400px);height:min(100%,400px);display:flex;align-items:center;justify-content:center}
        .jarvis-voice__visual .square span{position:absolute;inset:0;width:100%;height:100%;background-image:radial-gradient(#6b72ff00 50%,#000dff3b 40%);box-shadow:0 0 50px rgb(25,0,255),inset 0 0 50px rgb(25,0,255);border-radius:38% 62% 63% 37% / 41% 44% 56% 59%;transition:filter .5s;animation:jarvis-orbit-a 6s linear infinite}
        .jarvis-voice__visual .square span:nth-child(2){animation-name:jarvis-orbit-b;animation-duration:4s;opacity:.88}
        .jarvis-voice__visual .square span:nth-child(3){animation-name:jarvis-orbit-c;animation-duration:8s;opacity:.76}
        .jarvis-voice__visual[data-speaking="true"] .square span{filter:brightness(1.45);box-shadow:0 0 65px rgb(25,0,255),inset 0 0 65px rgb(25,0,255)}
        .jarvis-voice__visual canvas{position:absolute;z-index:2;inset:0;width:100%;height:100%}
        @keyframes jarvis-orbit-a{to{transform:rotate(360deg)}}
        @keyframes jarvis-orbit-b{to{transform:rotate(-360deg)}}
        @keyframes jarvis-orbit-c{to{transform:rotate(360deg)}}
        .jarvis-voice__status{position:relative;z-index:3;min-height:36px;margin-top:2px;text-align:center}
        .jarvis-voice__footer{position:relative;z-index:3;width:min(calc(100% - 32px),390px);margin:0 auto 22px}
        .jarvis-voice__input{display:flex;align-items:center;gap:7px;border:1px solid blue;border-radius:8px;background:#181818a8;box-shadow:0 0 20px rgb(25,0,255);padding:3px 5px 3px 16px}
        .jarvis-voice__input input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#fff;padding:8px 0;font:13px Arial,sans-serif}
        .jarvis-voice__input input::placeholder{color:#777}
        .jarvis-voice__input button{display:grid;width:34px;height:34px;place-items:center;border:0;border-radius:9px;background:#111;color:#fff;cursor:pointer}
        .jarvis-voice__input button:disabled{opacity:.4;cursor:not-allowed}
        @media(max-height:620px){.jarvis-voice__visual{height:48vh;width:min(320px,76vw)}.jarvis-voice__footer{margin-bottom:12px}}
        @media(prefers-reduced-motion:reduce){.jarvis-voice__visual .square span{animation:none!important}}
      `}</style>

      <section className="jarvis-voice__stage">
        <div className="jarvis-voice__visual" data-speaking={isSpeaking}>
          <div className="square" aria-label="Animated blue energy field">
            <span />
            <span />
            <span />
          </div>
          <canvas ref={canvasRef} aria-label="Rotating blue particle sphere" />
        </div>
        <div className="jarvis-voice__status">
          <p className="text-sm font-semibold text-white">
            {isSpeaking ? "Nexus is speaking" : status}
          </p>
          {transcript && <p className="mt-2 max-w-lg text-xs text-zinc-500">{transcript}</p>}
        </div>
      </section>

      <footer className="jarvis-voice__footer">
        <form onSubmit={onSubmit}>
          <label htmlFor="nexus-voice-input" className="mb-3 block text-center text-xs font-semibold text-white">Ask me anything</label>
          <div className="jarvis-voice__input">
            <input id="nexus-voice-input" value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="Type your command here..." />
            <button type="button" onClick={onExit} aria-label="Turn microphone mode off" title="Exit microphone mode">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/></svg>
            </button>
            <button type="submit" disabled={!input.trim() || disabled} aria-label="Send command">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 12 14-7-4 14-3-6-7-1Z"/><path d="m12 13 7-8"/></svg>
            </button>
          </div>
        </form>
      </footer>
    </main>
  );
}
