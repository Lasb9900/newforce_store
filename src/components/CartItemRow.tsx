"use client";

import { CartItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function CartItemRow({ item, onQty, onRemove }: { item: CartItem; onQty: (qty: number) => void; onRemove: () => void }) {
  return (
    <div className="grid gap-3 border-b border-uiBorder py-4 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p className="font-semibold text-brand-ink">{item.name ?? "Producto"}</p>
        <p className="text-sm font-light text-mutedText">{item.variantName ?? "Sin variante"}</p>
        <p className="text-sm font-semibold text-brand-primary">{formatCurrency(item.unitPriceCents ?? 0)}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={item.qty}
          onChange={(e) => onQty(Number(e.target.value))}
          className="w-20 rounded-md border border-uiBorder p-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
        />
        <button onClick={onRemove} className="rounded-md px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50">
          Quitar
        </button>
      </div>
    </div>
  );
}
