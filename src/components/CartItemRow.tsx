"use client";

import Image from "next/image";
import { CartItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function CartItemRow({ item, onQty, onRemove }: { item: CartItem; onQty: (qty: number) => void; onRemove: () => void }) {
  const unit = item.unitPriceCents ?? 0;
  const lineSubtotal = unit * item.qty;

  return (
    <div className="grid gap-3 rounded-lg border border-uiBorder p-3 md:grid-cols-[72px_1fr_auto] md:items-center">
      <div className="relative h-[72px] w-[72px] overflow-hidden rounded-md bg-surfaceMuted">
        <Image src={item.imageUrl ?? "https://placehold.co/120x120?text=Product"} alt={item.name ?? "Producto"} fill className="object-cover" sizes="72px" />
      </div>
      <div>
        <p className="font-semibold text-brand-ink">{item.name ?? "Producto"}</p>
        <p className="text-sm text-mutedText">{item.variantName ?? "Sin variante"}</p>
        <p className="text-sm text-mutedText">Precio unitario: <span className="font-semibold text-brand-primary">{formatCurrency(unit)}</span></p>
        <p className="text-sm text-mutedText">Subtotal: <span className="font-semibold">{formatCurrency(lineSubtotal)}</span></p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={item.qty}
          onChange={(e) => onQty(Math.max(1, Number(e.target.value) || 1))}
          className="w-20 rounded-md border border-uiBorder p-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
          aria-label="Cantidad"
        />
        <button onClick={onRemove} className="rounded-md px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50">
          Quitar
        </button>
      </div>
    </div>
  );
}
