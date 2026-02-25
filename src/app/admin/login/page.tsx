"use client";

import Image from "next/image";
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
    <div className="mx-auto mt-12 max-w-md rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <Image src="/brand/cta-isotipo.svg" alt="CTA" width={32} height={32} />
        <h1 className="text-2xl font-bold">Admin Login</h1>
      </div>
      <div className="space-y-3">
        <input className="w-full rounded-md border border-uiBorder p-2.5 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email"/>
        <input type="password" className="w-full rounded-md border border-uiBorder p-2.5 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="password"/>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" onClick={signIn}>Entrar</button>
      </div>
    </div>
  );
}
