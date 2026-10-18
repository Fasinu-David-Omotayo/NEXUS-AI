"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account created successfully.");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 p-8">
        <h1 className="mb-6 text-3xl font-bold">
          Create Account
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
          onClick={handleSignup}
          className="w-full rounded-xl bg-white p-3 font-medium text-black"
        >
          Sign Up
        </button>
      </div>
    </main>
  );
}