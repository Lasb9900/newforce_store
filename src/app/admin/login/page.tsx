"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function signIn() {
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    await supabase.auth.signInWithPassword({ email, password });
    location.href = "/admin";
  }

  return <div className="max-w-md space-y-2"><h1 className="text-2xl font-bold">Admin Login</h1><input className="w-full border p-2" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email"/><input type="password" className="w-full border p-2" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="password"/><button className="rounded bg-black px-4 py-2 text-white" onClick={signIn}>Entrar</button></div>;
}
