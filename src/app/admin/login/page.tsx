"use client";

import Image from "next/image";
import { useState } from "react";

function friendlyErrorFromStatus(status: number, fallback?: string) {
  if (status === 401) return "Credenciales inválidas";
  if (status === 403) return "No tienes permisos de administrador";
  if (status === 404) return "Endpoint de login no encontrado";
  if (status === 503) return "No se pudo conectar al servicio de autenticación";
  if (status >= 500) return "Error interno del servidor";
  return fallback || "No se pudo iniciar sesión";
}

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data: { error?: string } | null = null;
      try {
        data = (await response.json()) as { error?: string };
      } catch {
        data = null;
      }

      if (!response.ok) {
        setError(friendlyErrorFromStatus(response.status, data?.error));
        setLoading(false);
        return;
      }

      location.href = "/admin";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error de red";
      setError(`Error de red: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-md rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <Image src="/brand/cta-isotipo.svg" alt="CTA" width={32} height={32} />
        <h1 className="text-2xl font-bold">Admin Login</h1>
      </div>
      <div className="space-y-3">
        <input className="w-full rounded-md border border-uiBorder p-2.5 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <input type="password" className="w-full rounded-md border border-uiBorder p-2.5 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" onClick={signIn} disabled={loading}>{loading ? "Ingresando..." : "Entrar"}</button>
      </div>
    </div>
  );
}
