"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 p-8">
        <h1 className="mb-6 text-3xl font-bold">
          Welcome Back
        </h1>

        <input
          className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3"
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="mb-6 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="w-full rounded-xl bg-white p-3 font-medium text-black"
        >
          Login
        </button>
      </div>
    </main>
  );
}