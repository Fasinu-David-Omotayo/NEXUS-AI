"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export default function ConversationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const { data, error: loadError } = await supabase
      .from("conversations")
      .select("id,title,created_at,updated_at")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false });
    if (loadError) setError(loadError.message);
    else setItems((data ?? []) as Conversation[]);
    setLoading(false);
  }, [router]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? items.filter((item) => item.title.toLowerCase().includes(needle)) : items;
  }, [items, query]);

  const createConversation = async () => {
    setCreating(true);
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }
    const { data, error: createError } = await supabase
      .from("conversations")
      .insert({ user_id: session.user.id, title: "New conversation" })
      .select("id,title,created_at,updated_at")
      .single();
    if (createError) setError(createError.message);
    else if (data) {
      setItems((current) => [data as Conversation, ...current]);
      setEditingId(data.id);
      setEditingTitle(data.title);
    }
    setCreating(false);
  };

  const saveTitle = async (id: string) => {
    const title = editingTitle.trim();
    if (!title) { setError("A conversation title cannot be empty."); return; }
    const { error: updateError } = await supabase
      .from("conversations").update({ title }).eq("id", id);
    if (updateError) setError(updateError.message);
    else {
      setItems((current) => current.map((item) => item.id === id ? { ...item, title } : item));
      setEditingId(null);
    }
  };

  const deleteConversation = async (id: string) => {
    if (!window.confirm("Delete this conversation and all its messages? This cannot be undone.")) return;
    const { error: deleteError } = await supabase.from("conversations").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else setItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <main className="min-h-screen bg-[#090909] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-white">← Back to Nexus AI</Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Conversations</h1>
            <p className="mt-2 text-sm text-zinc-500">Manage your saved conversation records.</p>
          </div>
          <button onClick={createConversation} disabled={creating} className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50">
            {creating ? "Creating..." : "+ New conversation"}
          </button>
        </div>

        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversation titles..." className="mb-5 w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-white/30" />
        {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{error}</p>}
        {loading ? <p className="py-12 text-center text-sm text-zinc-500">Loading conversations...</p> :
          filtered.length === 0 ? <div className="rounded-2xl border border-white/10 p-10 text-center"><p className="text-zinc-300">{query ? "No matching conversations." : "No conversations saved yet."}</p><p className="mt-2 text-sm text-zinc-600">Create a conversation to start your history.</p></div> :
          <div className="space-y-3">{filtered.map((item) => (
            <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#111] p-4">
              <div className="min-w-0 flex-1">
                {editingId === item.id ? <input autoFocus value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveTitle(item.id); if (event.key === "Escape") setEditingId(null); }} className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm outline-none" /> :
                  <h2 className="truncate text-sm font-medium">{item.title}</h2>}
                <p className="mt-1 text-xs text-zinc-600">Updated {new Date(item.updated_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/dashboard?conversation=${item.id}`} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5">Open</Link>
                {editingId === item.id ? <>
                  <button onClick={() => void saveTitle(item.id)} className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-black">Save</button>
                  <button onClick={() => setEditingId(null)} className="rounded-lg px-3 py-2 text-xs text-zinc-400 hover:bg-white/5">Cancel</button>
                </> : <button onClick={() => { setEditingId(item.id); setEditingTitle(item.title); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5">Rename</button>}
                <button onClick={() => void deleteConversation(item.id)} className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10">Delete</button>
              </div>
            </article>
          ))}</div>}
      </div>
    </main>
  );
}
