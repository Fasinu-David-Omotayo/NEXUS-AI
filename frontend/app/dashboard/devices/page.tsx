"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Device = {
  id: string;
  device_name: string;
  operating_system: string;
  status: "pending" | "online" | "offline" | "revoked";
  paired_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

type PairingCode = {
  code: string;
  expires_at: string;
  device_name: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_NEXUS_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

export default function DesktopDevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceName, setDeviceName] = useState("My Windows PC");
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const authorizedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.replace("/login");
      throw new Error("Your session has expired. Please sign in again.");
    }
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(init.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof body.detail === "string" ? body.detail : "The request failed.");
    }
    return body;
  }, [router]);

  const loadDevices = useCallback(async () => {
    setError("");
    try {
      const body = await authorizedFetch("/v2/desktop/devices");
      setDevices(Array.isArray(body.devices) ? body.devices : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load devices.");
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const createCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setPairing(null);
    try {
      const body = await authorizedFetch("/v2/desktop/pairing-code", {
        method: "POST",
        body: JSON.stringify({ device_name: deviceName.trim() || "My Windows PC" }),
      });
      setPairing(body as PairingCode);
      setNotice("Pairing code created. It expires in 10 minutes and can only be used once.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create pairing code.");
    } finally {
      setBusy(false);
    }
  };

  const revokeDevice = async (device: Device) => {
    if (!window.confirm(`Revoke access for “${device.device_name}”? This will disconnect it and stop future commands.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await authorizedFetch(`/v2/desktop/devices/${encodeURIComponent(device.id)}/revoke`, { method: "POST" });
      setNotice(`Access revoked for ${device.device_name}.`);
      await loadDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke this device.");
    } finally {
      setBusy(false);
    }
  };

  const statusClass = (status: Device["status"]) => {
    if (status === "online") return "text-emerald-300 bg-emerald-400/10";
    if (status === "revoked") return "text-red-300 bg-red-400/10";
    if (status === "pending") return "text-amber-200 bg-amber-300/10";
    return "text-zinc-300 bg-white/5";
  };

  return (
    <main className="min-h-screen bg-[#090909] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm text-zinc-500 transition hover:text-white">← Back to Nexus AI</Link>
        <header className="mt-8 border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Account settings</p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight">Desktop devices</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Pair a Windows computer only when you are physically using it. Each device belongs to your account, and you can revoke its access here at any time.
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-6">
          <h2 className="text-lg font-medium">Pair a new computer</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Generate a one-time code, then enter it when the Nexus AI Desktop app opens its pairing window on the computer you want to authorize. If you previously revoked this computer, the app will clear its old credentials and ask for a fresh code automatically.
          </p>
          <form onSubmit={createCode} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="mb-2 block text-xs text-zinc-500">Device name</span>
              <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} maxLength={120} className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-white/30" placeholder="My Windows PC" />
            </label>
            <button disabled={busy} type="submit" className="self-end rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50">{busy ? "Working…" : "Generate pairing code"}</button>
          </form>

          {pairing && (
            <div className="mt-5 rounded-xl border border-white/10 bg-black p-4">
              <p className="text-xs text-zinc-500">One-time pairing code</p>
              <p className="mt-2 select-all font-mono text-3xl font-semibold tracking-[0.2em]">{pairing.code}</p>
              <p className="mt-3 text-xs text-zinc-500">Expires: {new Date(pairing.expires_at).toLocaleString()}</p>
              <p className="mt-2 text-xs text-amber-200">Treat this code like a temporary password. Do not share it with anyone or paste it into a public chat.</p>
            </div>
          )}
        </section>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200">{notice}</p>}

        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium">Your paired devices</h2>
            <button type="button" onClick={() => void loadDevices()} disabled={loading || busy} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50">Refresh</button>
          </div>
          {loading ? (
            <p className="py-8 text-sm text-zinc-500">Loading devices…</p>
          ) : devices.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center">
              <p className="text-sm text-zinc-300">No desktop devices yet</p>
              <p className="mt-2 text-sm text-zinc-600">Generate a pairing code above to begin.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {devices.map((device) => (
                <article key={device.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#111] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-medium">{device.device_name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] ${statusClass(device.status)}`}>{device.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">{device.operating_system} · Paired {device.paired_at ? new Date(device.paired_at).toLocaleString() : "date unavailable"}</p>
                    {device.last_seen_at && <p className="mt-1 text-xs text-zinc-600">Last connected: {new Date(device.last_seen_at).toLocaleString()}</p>}
                  </div>
                  {device.status !== "revoked" && (
                    <button type="button" disabled={busy} onClick={() => void revokeDevice(device)} className="rounded-xl border border-red-400/20 px-4 py-2.5 text-sm text-red-200 transition hover:bg-red-400/10 disabled:opacity-50">Revoke access</button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
        <p className="mt-10 text-xs leading-5 text-zinc-600">Security note: pairing is account-scoped. Device tokens are hashed on the server; the raw device token is only returned once to the pairing client.</p>
      </div>
    </main>
  );
}
