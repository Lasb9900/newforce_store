"use client";

import { useState } from "react";

type RedeemableProduct = { id: string; name: string; points_price: number | null; base_stock: number };

export default function RedeemPointsForm({ products }: { products: RedeemableProduct[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/me/points/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, qty }),
    });
    const json = await res.json();
    setMessage(res.ok ? "Redención completada" : json.error || "No se pudo redimir");
    if (res.ok) window.location.reload();
  }

  return (
    <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">Redimir por puntos</h2>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
        <select className="rounded-md border border-uiBorder p-2" value={productId} onChange={(e) => setProductId(e.target.value)}>
          {products.map((product) => (
            <option key={product.id} value={product.id}>{product.name} · {product.points_price ?? 0} pts</option>
          ))}
        </select>
        <input className="rounded-md border border-uiBorder p-2" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        <button className="btn-primary" type="submit">Redimir</button>
      </form>
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
    </article>
  );
}
