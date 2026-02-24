"use client";

import { CartItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function CartItemRow({
  item,
  onQty,
  onRemove,
}: {
  item: CartItem;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b py-3">
      <div>
        <p className="font-medium">{item.name ?? "Producto"}</p>
        <p className="text-sm text-gray-500">{item.variantName}</p>
        <p>{formatCurrency(item.unitPriceCents ?? 0)}</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min={1} value={item.qty} onChange={(e) => onQty(Number(e.target.value))} className="w-16 rounded border p-1" />
        <button onClick={onRemove} className="text-red-600">Quitar</button>
      </div>
    </div>
  );
}
