"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return;
    }
    location.href = "/admin";
  }

  return (
    <div className="mx-auto mt-12 max-w-md rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="mb-4 text-2xl font-bold">Admin Login</h1>
      <div className="space-y-2">
        <input className="w-full rounded border border-slate-300 p-2" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email"/>
        <input type="password" className="w-full rounded border border-slate-300 p-2" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="password"/>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="rounded bg-slate-900 px-4 py-2 text-white" onClick={signIn}>Entrar</button>
      </div>
    </div>
  );
}
