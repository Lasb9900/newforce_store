"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "No se pudo registrar");
      return;
    }

    router.push("/account");
    router.refresh();
  }

  return (
    <div className="mx-auto mt-8 max-w-xl rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">Registro de cliente</h1>
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
        <input className="rounded-md border border-uiBorder p-2.5" required placeholder="Nombre" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
        <input className="rounded-md border border-uiBorder p-2.5" required placeholder="Apellido" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
        <input className="rounded-md border border-uiBorder p-2.5 md:col-span-2" type="email" required placeholder="Correo" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        <input className="rounded-md border border-uiBorder p-2.5 md:col-span-2" required placeholder="Teléfono" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        <input className="rounded-md border border-uiBorder p-2.5 md:col-span-2" type="password" minLength={8} required placeholder="Contraseña (mínimo 8 caracteres)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
        <button disabled={loading} className="btn-primary md:col-span-2" type="submit">{loading ? "Creando cuenta..." : "Crear cuenta"}</button>
      </form>
    </div>
  );
}
