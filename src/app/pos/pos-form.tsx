"use client";

import { useState } from "react";

type PosProduct = { id: string; name: string; base_price_cents: number | null; base_stock: number };

export default function PosForm({ products }: { products: PosProduct[] }) {
  const [selected, setSelected] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/pos/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerEmail: customerEmail || undefined, paymentMethod, items: [{ productId: selected, qty }] }),
    });
    const data = await res.json();
    setMessage(res.ok ? `Venta registrada: ${data.orderId}` : data.error || "Error al registrar venta");
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <select className="rounded-md border border-uiBorder p-2" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
        <input className="rounded-md border border-uiBorder p-2" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        <input className="rounded-md border border-uiBorder p-2" placeholder="Email cliente (opcional)" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
        <select className="rounded-md border border-uiBorder p-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="cash">Efectivo</option>
          <option value="card">Tarjeta</option>
          <option value="transfer">Transferencia</option>
        </select>
      </div>
      <button className="btn-primary mt-3" type="submit">Registrar venta física</button>
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
    </form>
  );
}
