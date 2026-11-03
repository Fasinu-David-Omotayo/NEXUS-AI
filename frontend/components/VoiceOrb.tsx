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

type Particle = { x: number; y: number; z: number; size: number; speed: number; phase: number };
const PARTICLE_COUNT = 560;

export default function VoiceOrb({ status, isSpeaking, listening, transcript, onExit }: VoiceOrbProps) {
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
        x: Math.sin(phi) * Math.cos(theta), y: Math.cos(phi), z: Math.sin(phi) * Math.sin(theta),
        size: 0.45 + Math.random() * 1.35, speed: 0.75 + Math.random() * 0.7, phase: Math.random() * Math.PI * 2,
      };
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      if (disposed) return;
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2, cy = height / 2;
      const radius = Math.min(width * 0.235, height * 0.30, 190);
      const energy = isSpeaking ? 1 : listening ? 0.82 : 0.62;
      rotation += isSpeaking ? 0.011 : 0.005;

      const glow = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius * 2.15);
      glow.addColorStop(0, "rgba(0,0,255,0)");
      glow.addColorStop(0.48, `rgba(0,35,255,${0.16 * energy})`);
      glow.addColorStop(0.7, `rgba(35,0,255,${0.28 * energy})`);
      glow.addColorStop(1, "rgba(0,0,100,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, radius * 2.15, 0, Math.PI * 2); ctx.fill();

      ctx.save();
      ctx.fillStyle = "#010208"; ctx.shadowColor = "#1900ff"; ctx.shadowBlur = isSpeaking ? 48 : 32;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();

      const cos = Math.cos(rotation), sin = Math.sin(rotation);
      const projected = particles.map((p) => {
        const x = p.x * cos - p.z * sin, z = p.x * sin + p.z * cos;
        const shimmer = 0.8 + Math.sin(rotation * p.speed + p.phase) * 0.2;
        return { x: cx + x * radius * 0.94, y: cy + p.y * radius * 0.94, z,
          size: p.size * (0.76 + (z + 1) * 0.12),
          alpha: Math.max(0.06, (0.2 + (z + 1) * 0.35) * shimmer * energy) };
      }).sort((a, b) => a.z - b.z);

      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius * 0.99, 0, Math.PI * 2); ctx.clip();
      for (const p of projected) {
        ctx.beginPath(); ctx.fillStyle = `rgba(0,${isSpeaking ? 115 : 92},255,${p.alpha})`;
        ctx.shadowColor = "#0750ff"; ctx.shadowBlur = p.z > 0 ? 8 : 1;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      ctx.save();
      for (let i = 0; i < 34; i++) {
        const angle = rotation * (i % 2 ? -1.55 : 1.3) + i * Math.PI * 2 / 34;
        const x = cx + Math.cos(angle) * radius * 1.46, y = cy + Math.sin(angle) * radius * 0.58;
        ctx.beginPath(); ctx.fillStyle = `rgba(55,100,255,${(0.18 + (Math.sin(angle * 1.7) + 1) * 0.2) * energy})`;
        ctx.shadowColor = "#1900ff"; ctx.shadowBlur = 11; ctx.arc(x, y, i % 4 === 0 ? 2 : 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    raf = requestAnimationFrame(draw);
    return () => { disposed = true; cancelAnimationFrame(raf); observer.disconnect(); };
  }, [isSpeaking, listening]);

  return (
    <main className="nexus-voice-screen">
      <style jsx global>{`
        .nexus-voice-screen{position:fixed;inset:0;z-index:50;width:100vw;height:100dvh;min-height:100%;overflow:hidden;background:#000;color:#fff}
        .nexus-voice-back{position:absolute;top:max(24px,env(safe-area-inset-top));left:max(24px,env(safe-area-inset-left));z-index:10;display:flex;align-items:center;gap:10px;border:1px solid rgba(115,130,255,.22);border-radius:999px;padding:10px 15px;background:rgba(8,10,22,.72);color:#dce2ff;font-size:13px;backdrop-filter:blur(12px);transition:background .2s,border-color .2s}
        .nexus-voice-back:hover{background:rgba(25,30,75,.85);border-color:rgba(115,130,255,.55)}
        .nexus-voice-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
        .nexus-voice-visual{position:relative;width:min( min(82vw, 760px), 76vh);height:min(min(82vw,760px),76vh);isolation:isolate}
        .nexus-voice-visual .energy-shape{position:absolute;inset:0;border-radius:38% 62% 63% 37% / 41% 44% 56% 59%;background:radial-gradient(ellipse at center,rgba(30,35,255,.03) 43%,rgba(0,0,255,.18) 67%,transparent 72%);box-shadow:0 0 72px rgba(25,0,255,.48),inset 0 0 65px rgba(25,0,255,.55);animation:nexus-energy-a 7s linear infinite}
        .nexus-voice-visual .energy-shape:nth-child(2){animation-name:nexus-energy-b;animation-duration:5.2s;opacity:.78;transform:scale(.91)}
        .nexus-voice-visual .energy-shape:nth-child(3){animation-name:nexus-energy-a;animation-duration:9s;opacity:.55;transform:scale(1.08)}
        .nexus-voice-visual[data-speaking="true"] .energy-shape{filter:brightness(1.45);box-shadow:0 0 95px rgba(25,0,255,.65),inset 0 0 80px rgba(25,0,255,.7)}
        .nexus-voice-visual canvas{position:absolute;inset:0;width:100%;height:100%;z-index:2}
        @keyframes nexus-energy-a{to{transform:rotate(360deg)}}
        @keyframes nexus-energy-b{to{transform:rotate(-360deg) scale(.91)}}
        .nexus-voice-status{position:absolute;bottom:max(44px,env(safe-area-inset-bottom));left:20px;right:20px;text-align:center;color:#aeb8df;font-size:13px;letter-spacing:.04em}
        .nexus-voice-status strong{display:block;margin-bottom:8px;color:#fff;font-size:15px;font-weight:500}
        .nexus-voice-transcript{max-width:680px;margin:0 auto;color:#8b93ae;font-size:13px;line-height:1.6}
        @media(max-width:600px){.nexus-voice-back{top:max(16px,env(safe-area-inset-top));left:16px;padding:9px 12px}.nexus-voice-visual{width:92vw;height:92vw;max-height:62vh}.nexus-voice-status{bottom:max(30px,env(safe-area-inset-bottom))}}
        @media(prefers-reduced-motion:reduce){.nexus-voice-visual .energy-shape{animation:none}}
      `}</style>

      <button type="button" className="nexus-voice-back" onClick={onExit} aria-label="Return to chat">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span>Back to chat</span>
      </button>

      <section className="nexus-voice-stage" aria-label="Nexus voice assistant">
        <div className="nexus-voice-visual" data-speaking={isSpeaking}>
          <span className="energy-shape" /><span className="energy-shape" /><span className="energy-shape" />
          <canvas ref={canvasRef} aria-label="Animated blue particle sphere" />
        </div>
      </section>

      <div className="nexus-voice-status" aria-live="polite">
        <strong>{isSpeaking ? "Nexus is speaking" : status || (listening ? "Listening..." : "Nexus is ready")}</strong>
        {transcript && <p className="nexus-voice-transcript">{transcript}</p>}
      </div>
    </main>
  );
}
