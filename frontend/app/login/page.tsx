"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        setError(
          loginError.message === "Invalid login credentials"
            ? "The email or password is incorrect. Check your details and try again."
            : loginError.message
        );
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("We couldn't sign you in right now. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#101110] px-5 py-12 text-[#f1f1eb]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-[#a6bb91]/[0.08] blur-[110px]" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="mx-auto mb-8 flex w-fit items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e4e5da] text-[#151612]">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 5h14v14H5z" />
              <path d="M9 9h6v6H9z" />
            </svg>
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.6px]">nexus<span className="text-[#b8c9a8]">ai</span></span>
        </Link>

        <section className="rounded-2xl border border-white/[0.1] bg-[#151613] p-7 shadow-2xl shadow-black/20 sm:p-9">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#9da58f]">Your workspace awaits</p>
          <h1 className="mt-3 text-3xl font-medium tracking-[-1.2px]">Welcome back.</h1>
          <p className="mt-2 text-sm leading-6 text-[#a5a69e]">Sign in to continue your conversations and work.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-[#c7c8bf]">Email address</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/[0.12] bg-[#0f100e] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#66685f] focus:border-[#b8c9a8]/70"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium text-[#c7c8bf]">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-white/[0.12] bg-[#0f100e] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#66685f] focus:border-[#b8c9a8]/70"
              />
            </label>

            {error && (
              <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm leading-5 text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#e4e5da] px-5 text-sm font-semibold text-[#171813] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing you in…" : "Sign in"}
              {!loading && <span aria-hidden="true">↗</span>}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-[#92948a]">
            New to Nexus AI?{" "}
            <Link href="/signup" className="font-medium text-[#c6d4b8] transition hover:text-white">Create an account</Link>
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-[#696b63]">
          <Link href="/" className="transition hover:text-[#c7c8bf]">Back to Nexus AI</Link>
          <span className="px-2">·</span>
          <Link href="/download" className="transition hover:text-[#c7c8bf]">Get the Windows app</Link>
        </p>
      </div>
    </main>
  );
}
