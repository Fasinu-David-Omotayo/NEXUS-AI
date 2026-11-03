"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function BrandMark() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/25 bg-blue-500/10 text-blue-300 shadow-[0_0_28px_rgba(30,64,255,0.18)]">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 5h14v14H5z" /><path d="M9 9h6v6H9z" /></svg>
    </span>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 8) { setError("Use a password with at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Your passwords do not match. Please check and try again."); return; }
    setLoading(true);
    try {
      const { data, error: signupError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (signupError) { setError(signupError.message); return; }
      if (data.session) { router.replace("/dashboard"); router.refresh(); return; }
      setSuccess("Your account has been created. Check your email for a confirmation link, then sign in to continue.");
    } catch {
      setError("We couldn't create your account right now. Please check your connection and try again.");
    } finally { setLoading(false); }
  };

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#05060b] text-white lg:grid-cols-[1.05fr_0.95fr]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_30%,rgba(13,35,180,0.2),transparent_45%),radial-gradient(ellipse_at_85%_80%,rgba(0,65,255,0.1),transparent_38%)]" />
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-white/[0.07] px-12 py-10 lg:flex xl:px-20">
        <Link href="/" className="relative z-10 flex w-fit items-center gap-3"><BrandMark /><span className="text-lg font-semibold tracking-tight">Nexus<span className="text-blue-400">AI</span></span></Link>
        <div className="relative z-10 max-w-xl pb-10">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-blue-300">A clearer way to work</p>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.055em] xl:text-6xl">Bring your ideas into focus.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-zinc-400">Create your account and bring research, conversations and everyday tasks into one place.</p>
        </div>
        <div className="relative z-10 flex items-center gap-2 text-xs text-zinc-600"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Nexus AI · Intelligent workspace</div>
        <div className="pointer-events-none absolute -right-28 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full border border-blue-500/10 shadow-[0_0_100px_rgba(0,20,255,0.12)]"><div className="absolute inset-10 rounded-full border border-blue-500/15" /><div className="absolute inset-24 rounded-full border border-blue-400/15" /><div className="absolute inset-[34%] rounded-full bg-blue-600/10 blur-2xl" /><div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/20 bg-[#02040c] shadow-[0_0_75px_rgba(0,25,255,0.3)]" /></div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="mb-10 flex w-fit items-center gap-3 lg:hidden"><BrandMark /><span className="text-lg font-semibold tracking-tight">Nexus<span className="text-blue-400">AI</span></span></Link>
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Get started</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Create your account</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">A workspace for your ideas, research and productivity.</p>
          </div>
          <form onSubmit={handleSignup} className="space-y-4">
            <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">Email address</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500/70 focus:bg-blue-500/[0.04] focus:ring-2 focus:ring-blue-500/10" /></label>
            <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">Password</span><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500/70 focus:bg-blue-500/[0.04] focus:ring-2 focus:ring-blue-500/10" /><span className="mt-1.5 block text-[11px] text-zinc-600">Use at least 8 characters.</span></label>
            <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">Confirm password</span><input type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500/70 focus:bg-blue-500/[0.04] focus:ring-2 focus:ring-blue-500/10" /></label>
            {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm leading-5 text-red-200">{error}</p>}
            {success && <div role="status" className="rounded-xl border border-blue-400/20 bg-blue-400/[0.07] px-4 py-3 text-sm leading-5 text-blue-100">{success}<Link href="/login" className="mt-2 inline-block font-semibold underline underline-offset-4">Go to sign in</Link></div>}
            <button type="submit" disabled={loading || !email.trim() || !password || !confirmPassword} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(30,64,255,0.2)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-45">{loading ? "Creating your account…" : "Create account"} {!loading && <span aria-hidden="true">→</span>}</button>
          </form>
          <p className="mt-7 text-center text-sm text-zinc-500">Already have an account? <Link href="/login" className="font-semibold text-blue-300 transition hover:text-white">Sign in</Link></p>
          <div className="mt-9 flex items-center justify-center gap-4 text-xs text-zinc-600"><Link href="/" className="hover:text-zinc-300">Back to home</Link><span>·</span><Link href="/download" className="hover:text-zinc-300">Windows app</Link></div>
        </div>
      </section>
    </main>
  );
}
