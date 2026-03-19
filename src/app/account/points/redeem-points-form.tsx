"use client";

import { useMemo, useState } from "react";

type RedeemableProduct = {
  id: string;
  name: string;
  points_price: number | null;
  base_stock: number;
};

type ShippingForm = {
  full_name: string;
  email: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: "US";
  delivery_notes: string;
};

const EMPTY_SHIPPING: ShippingForm = {
  full_name: "",
  email: "",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
  delivery_notes: "",
};

export default function RedeemPointsForm({
  products,
  availablePoints,
}: {
  products: RedeemableProduct[];
  availablePoints: number;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [shipping, setShipping] = useState<ShippingForm>(EMPTY_SHIPPING);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) ?? null,
    [products, productId],
  );

  const totalPoints = (selectedProduct?.points_price ?? 0) * qty;

  const canSubmit =
    Boolean(selectedProduct) &&
    qty > 0 &&
    !loading &&
    totalPoints > 0 &&
    totalPoints <= availablePoints;

  function updateShipping<K extends keyof ShippingForm>(key: K, value: ShippingForm[K]) {
    setShipping((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!productId) {
      setMessage("Selecciona un producto");
      return;
    }

    if (qty <= 0) {
      setMessage("La cantidad debe ser mayor a 0");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/me/points/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          qty,
          shipping: {
            ...shipping,
            state: shipping.state.toUpperCase(),
            address_line_2: shipping.address_line_2 || undefined,
            delivery_notes: shipping.delivery_notes || undefined,
          },
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const backendError =
          typeof json.error === "string"
            ? json.error
            : json.error?.formErrors?.[0] ||
              Object.values(json.error?.fieldErrors ?? {}).flat()?.[0] ||
              "No se pudo redimir";

        setMessage(String(backendError));
        return;
      }

      setMessage("Redención completada");
      window.location.reload();
    } catch {
      setMessage("Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">Redimir por puntos</h2>

      {products.length === 0 ? (
        <p className="text-sm text-mutedText">No hay productos disponibles para redimir.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="rounded-md border border-uiBorder p-2"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Selecciona un producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.points_price ?? 0} pts · Stock: {product.base_stock}
                </option>
              ))}
            </select>

            <input
              className="rounded-md border border-uiBorder p-2"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />

            <button
              className="btn-primary disabled:opacity-60"
              type="submit"
              disabled={!canSubmit}
            >
              {loading ? "Redimiendo..." : "Redimir"}
            </button>
          </div>

          {selectedProduct ? (
            <div className="rounded-md border border-uiBorder p-3 text-sm">
              <p className="font-semibold">{selectedProduct.name}</p>
              <p className="text-mutedText">Costo por unidad: {selectedProduct.points_price ?? 0} pts</p>
              <p className="text-mutedText">Total: {totalPoints} pts</p>
              <p className="text-mutedText">Tus puntos: {availablePoints}</p>
            </div>
          ) : null}

          <div className="rounded-xl border border-uiBorder p-4">
            <h3 className="mb-3 text-base font-semibold">Dirección de envío</h3>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-md border border-uiBorder p-2"
                placeholder="Nombre completo"
                value={shipping.full_name}
                onChange={(e) => updateShipping("full_name", e.target.value)}
              />

              <input
                className="rounded-md border border-uiBorder p-2"
                placeholder="Email"
                type="email"
                value={shipping.email}
                onChange={(e) => updateShipping("email", e.target.value)}
              />

              <input
                className="rounded-md border border-uiBorder p-2"
                placeholder="Teléfono"
                value={shipping.phone}
                onChange={(e) => updateShipping("phone", e.target.value)}
              />

              <input
                className="rounded-md border border-uiBorder p-2"
                placeholder="Address line 1"
                value={shipping.address_line_1}
                onChange={(e) => updateShipping("address_line_1", e.target.value)}
              />

              <input
                className="rounded-md border border-uiBorder p-2"
                placeholder="Address line 2 (opcional)"
                value={shipping.address_line_2}
                onChange={(e) => updateShipping("address_line_2", e.target.value)}
              />

              <input
                className="rounded-md border border-uiBorder p-2"
                placeholder="City"
                value={shipping.city}
                onChange={(e) => updateShipping("city", e.target.value)}
              />

              <input
                className="rounded-md border border-uiBorder p-2"
                placeholder="State (ej: FL)"
                maxLength={2}
                value={shipping.state}
                onChange={(e) => updateShipping("state", e.target.value.toUpperCase())}
              />

              <input
                className="rounded-md border border-uiBorder p-2"
                placeholder="ZIP code"
                value={shipping.postal_code}
                onChange={(e) => updateShipping("postal_code", e.target.value)}
              />

              <input
                className="rounded-md border border-uiBorder p-2 bg-surfaceMuted"
                value="US"
                readOnly
              />

              <input
                className="rounded-md border border-uiBorder p-2"
                placeholder="Notas de entrega (opcional)"
                value={shipping.delivery_notes}
                onChange={(e) => updateShipping("delivery_notes", e.target.value)}
              />
            </div>
          </div>
        </form>
      )}

      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </article>
  );
}