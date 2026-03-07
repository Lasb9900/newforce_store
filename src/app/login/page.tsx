"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Error de red inesperado";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "No se pudo iniciar sesión");
        return;
      }

      router.push(searchParams.get("next") || "/account");
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError(`Error de conexión: ${toErrorMessage(err)}`);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-md rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">Iniciar sesión</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded-md border border-uiBorder p-2.5" type="email" required placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded-md border border-uiBorder p-2.5" type="password" required placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button disabled={loading} className="btn-primary w-full" type="submit">{loading ? "Ingresando..." : "Ingresar"}</button>
      </form>
      <p className="mt-4 text-sm text-mutedText">
        ¿No tienes cuenta? <Link className="font-semibold text-brand-secondary" href="/register">Regístrate</Link>
      </p>
    </div>
  );
}
