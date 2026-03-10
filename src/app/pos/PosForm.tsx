"use client";

import { useMemo, useState } from "react";

type PosProduct = {
  id: string;
  name: string;
  item_number: string | null;
  sku: string | null;
  category: string | null;
  price_cents: number | null;
  qty: number;
  image_url: string | null;
  active: boolean;
};

type SaleResult = {
  orderId: string;
  productName: string;
  qty: number;
  paymentMethod: string;
  totalCents: number;
  createdAt: string;
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
] as const;

function formatCurrency(cents: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function PosForm({ products }: { products: PosProduct[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]["value"]>("cash");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.item_number ?? "", p.sku ?? "", p.category ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [products, query]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selected) ?? null,
    [products, selected],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!selected) {
      setError("Debes seleccionar un producto");
      return;
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      setError("Cantidad inválida");
      return;
    }

    if (selectedProduct && qty > selectedProduct.qty) {
      setError(`Stock insuficiente. Disponible: ${selectedProduct.qty}`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/pos/sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerEmail: customerEmail.trim() || undefined,
          paymentMethod,
          items: [{ productId: selected, qty }],
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo registrar la venta");
        return;
      }

      setMessage(`Venta registrada: ${data.orderId}`);
      setLastSale({
        orderId: data.orderId,
        productName: selectedProduct?.name ?? "Producto",
        qty,
        paymentMethod,
        totalCents: data.totalCents,
        createdAt: new Date().toISOString(),
      });
      setQty(1);
      setCustomerEmail("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border border-uiBorder p-2"
          placeholder="Buscar por nombre, Item #, SKU o categoría"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select className="rounded-md border border-uiBorder p-2" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {filteredProducts.length ? (
            filteredProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.item_number ?? product.sku ?? "sin código"})
              </option>
            ))
          ) : (
            <option value="">Sin resultados</option>
          )}
        </select>

        <input
          className="rounded-md border border-uiBorder p-2"
          type="number"
          min={1}
          max={Math.max(1, selectedProduct?.qty ?? 1)}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
        />

        <select className="rounded-md border border-uiBorder p-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "cash" | "card" | "transfer")}>
          {PAYMENT_METHODS.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </select>

        <input className="rounded-md border border-uiBorder p-2 md:col-span-2" placeholder="Email cliente (opcional)" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
      </div>

      {selectedProduct ? (
        <div className="mt-3 rounded-md border border-uiBorder p-3 text-sm">
          <p className="font-semibold">{selectedProduct.name}</p>
          <p>Item #: {selectedProduct.item_number ?? selectedProduct.sku ?? "—"}</p>
          <p>Categoría: {selectedProduct.category ?? "—"}</p>
          <p>Precio: {formatCurrency(selectedProduct.price_cents)}</p>
          <p>Stock: {selectedProduct.qty}</p>
        </div>
      ) : null}

      <button className="btn-primary mt-3" type="submit" disabled={saving || !selectedProduct}>
        {saving ? "Registrando..." : "Registrar venta física"}
      </button>

      {message ? <p className="mt-2 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {lastSale ? (
        <div className="mt-3 rounded-md border border-uiBorder bg-surfaceMuted p-3 text-sm">
          <p className="font-semibold">Última venta registrada</p>
          <p>Orden: {lastSale.orderId}</p>
          <p>Producto: {lastSale.productName}</p>
          <p>Cantidad: {lastSale.qty}</p>
          <p>Método de pago: {lastSale.paymentMethod}</p>
          <p>Total: {formatCurrency(lastSale.totalCents)}</p>
        </div>
      ) : null}
    </form>
  );
}
