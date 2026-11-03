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
  alpha: number;
};

const PARTICLE_COUNT = 520;

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
    let angle = 0;
    let disposed = false;
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      return {
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.cos(phi),
        z: Math.sin(phi) * Math.sin(theta),
        size: 0.55 + Math.random() * 1.25,
        speed: 0.72 + Math.random() * 0.8,
        alpha: 0.35 + Math.random() * 0.65,
      };
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      if (disposed) return;
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width * 0.205, height * 0.36, 142);
      const energy = isSpeaking ? 1 : listening ? 0.78 : 0.55;
      angle += isSpeaking ? 0.009 : 0.004;

      // The original Jarvis reference uses a layered organic blue energy field.
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.75, cx, cy, radius * 2.05);
      glow.addColorStop(0, "rgba(0,0,255,0)");
      glow.addColorStop(0.38, `rgba(0,0,255,${0.16 * energy})`);
      glow.addColorStop(0.66, `rgba(0,0,255,${0.25 * energy})`);
      glow.addColorStop(0.83, `rgba(14,0,255,${0.13 * energy})`);
      glow.addColorStop(1, "rgba(0,0,120,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2.05, 0, Math.PI * 2);
      ctx.fill();

      // Dark core keeps the particle globe legible against the blue aura.
      ctx.save();
      ctx.shadowColor = "#1200ff";
      ctx.shadowBlur = isSpeaking ? 42 : 28;
      ctx.fillStyle = "#010208";
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.98, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Project a rotating 3D particle sphere, with depth-based brightness.
      const projected: { x: number; y: number; z: number; size: number; alpha: number }[] = [];
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      for (const p of particles) {
        const x = p.x * cos - p.z * sin;
        const z = p.x * sin + p.z * cos;
        const perspective = 0.76 + (z + 1) * 0.12;
        projected.push({
          x: cx + x * radius * 0.88,
          y: cy + p.y * radius * 0.88,
          z,
          size: p.size * perspective,
          alpha: p.alpha * (0.18 + (z + 1) * 0.39) * energy,
        });
      }
      projected.sort((a, b) => a.z - b.z);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.97, 0, Math.PI * 2);
      ctx.clip();
      for (const p of projected) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(0, ${isSpeaking ? 105 : 83}, 255, ${p.alpha})`;
        ctx.shadowColor = "#004dff";
        ctx.shadowBlur = p.z > 0 ? 7 : 2;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Fine rotating orbit points create movement around the energy field.
      ctx.save();
      for (let i = 0; i < 28; i += 1) {
        const t = angle * (i % 2 ? -2.1 : 1.7) + (i / 28) * Math.PI * 2;
        const orbitX = Math.cos(t) * radius * 1.48;
        const orbitY = Math.sin(t) * radius * 0.49;
        const alpha = 0.14 + (Math.sin(t * 1.8) + 1) * 0.22;
        ctx.beginPath();
        ctx.fillStyle = `rgba(35,75,255,${alpha * energy})`;
        ctx.shadowColor = "#1700ff";
        ctx.shadowBlur = 9;
        ctx.arc(cx + orbitX, cy + orbitY, i % 4 === 0 ? 1.8 : 0.9, 0, Math.PI * 2);
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
    <main className="nexus-voice-screen">
      <style jsx global>{`
        .nexus-voice-screen{position:relative;display:flex;min-height:100dvh;flex-direction:column;overflow:hidden;background:#000;color:#fff}
        .nexus-voice-screen:before{position:absolute;inset:0;content:"";pointer-events:none;background:radial-gradient(ellipse at 50% 42%,rgba(0,0,75,.18),transparent 48%)}
        .nexus-voice-header{position:relative;z-index:3;display:flex;height:38px;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid rgba(255,255,255,.08);background:#080808;color:#a5a5a5;font-size:11px}
        .nexus-voice-stage{position:relative;display:flex;flex:1;min-height:0;flex-direction:column;align-items:center;justify-content:center;padding:0 16px 20px}
        .nexus-voice-visual{position:relative;display:flex;width:min(390px,82vw);height:min(390px,54vh);align-items:center;justify-content:center}
        .nexus-voice-visual canvas{position:absolute;inset:0;width:100%;height:100%;z-index:2}
        .nexus-voice-blob{position:absolute;inset:5%;border-radius:38% 62% 63% 37% / 41% 44% 56% 59%;background:radial-gradient(ellipse at center,transparent 48%,rgba(0,13,255,.18) 68%,rgba(0,13,255,.05) 100%);box-shadow:0 0 50px #1900ff,inset 0 0 50px #1900ff;animation:nexus-blob-one 6s linear infinite;transition:filter .3s}
        .nexus-voice-blob:nth-child(2){animation:nexus-blob-two 4s linear infinite;inset:3%;opacity:.85}
        .nexus-voice-blob:nth-child(3){animation:nexus-blob-three 8s linear infinite;inset:7%;opacity:.72}
        .nexus-voice-visual[data-speaking="true"] .nexus-voice-blob{filter:brightness(1.5);box-shadow:0 0 65px #1900ff,inset 0 0 65px #1900ff}
        @keyframes nexus-blob-one{to{transform:rotate(360deg)}}
        @keyframes nexus-blob-two{to{transform:rotate(-360deg)}}
        @keyframes nexus-blob-three{to{transform:rotate(360deg)}}
        .nexus-voice-prompt{position:relative;z-index:3;margin-top:0;text-align:center}
        .nexus-voice-input-wrap{position:relative;z-index:3;width:min(100% - 32px,390px);margin:0 auto 22px}
        .nexus-voice-input{display:flex;align-items:center;gap:8px;border:1px solid #1717a7;border-radius:9px;background:#111;box-shadow:0 0 18px #1900ff;padding:5px 7px 5px 14px}
        .nexus-voice-input input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#fff;font:12px Arial,sans-serif}
        .nexus-voice-input button{display:grid;width:31px;height:31px;place-items:center;border:0;border-radius:7px;background:#191919;color:#fff;cursor:pointer}
        .nexus-voice-input button:disabled{opacity:.4;cursor:not-allowed}
        @media(max-height:620px){.nexus-voice-visual{height:min(48vh,300px);width:min(300px,75vw)}.nexus-voice-input-wrap{margin-bottom:12px}}
        @media(prefers-reduced-motion:reduce){.nexus-voice-blob{animation:none!important}}
      `}</style>

      <header className="nexus-voice-header">
        <span>Jarvis</span>
        <button type="button" onClick={onExit} className="text-zinc-500 transition hover:text-white">Exit microphone mode</button>
      </header>

      <section className="nexus-voice-stage">
        <div className="nexus-voice-visual" data-speaking={isSpeaking}>
          <span className="nexus-voice-blob" />
          <span className="nexus-voice-blob" />
          <span className="nexus-voice-blob" />
          <canvas ref={canvasRef} aria-label="Live rotating blue particle sphere" />
        </div>
        <div className="nexus-voice-prompt">
          <p className="text-xs font-semibold tracking-wide text-white">
            {isSpeaking ? "Nexus is speaking" : status}
          </p>
          {transcript && <p className="mt-2 max-w-lg text-xs text-zinc-500">{transcript}</p>}
        </div>
      </section>

      <footer className="nexus-voice-input-wrap">
        <form onSubmit={onSubmit}>
          <label htmlFor="nexus-voice-input" className="mb-3 block text-center text-xs font-semibold text-white">Ask me anything</label>
          <div className="nexus-voice-input">
            <input id="nexus-voice-input" value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="Type your command here..." />
            <button type="button" onClick={onExit} aria-label="Exit microphone mode" title="Microphone mode on">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/></svg>
            </button>
            <button type="submit" disabled={!input.trim() || disabled} aria-label="Send message">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 12 14-7-4 14-3-6-7-1Z"/><path d="m12 13 7-8"/></svg>
            </button>
          </div>
        </form>
      </footer>
    </main>
  );
}
