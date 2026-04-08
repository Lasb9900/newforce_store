"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Error de red inesperado";
}

type LoginPageClientProps = {
  nextPath: string;
};

export default function LoginPageClient({ nextPath }: LoginPageClientProps) {
  const router = useRouter();
  const refreshAuth = useAuthStore((state) => state.refresh);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);

      console.info("[LOGIN_DEBUG] response", {
        ok: res.ok,
        userId: data?.userId ?? null,
        render: "client",
      });

      if (!res.ok) {
        setError(data?.error || "No se pudo iniciar sesión");
        return;
      }

      await refreshAuth();
      router.push(nextPath || "/account");
      router.refresh();
    } catch (err) {
      setError(`Error de conexión: ${toErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-md rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">Iniciar sesión</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full rounded-md border border-uiBorder p-2.5"
          type="email"
          required
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <input
          className="w-full rounded-md border border-uiBorder p-2.5"
          type="password"
          required
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          disabled={loading}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      <p className="mt-4 text-sm text-mutedText">
        ¿No tienes cuenta?{" "}
        <Link
          className="font-semibold text-brand-secondary"
          href="/register"
        >
          Regístrate
        </Link>
      </p>
    </div>
  );
}