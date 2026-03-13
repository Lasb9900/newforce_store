"use client";

import { CartItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";

export function CartItemRow({
  item,
  onQty,
  onRemove,
  disabled,
}: {
  item: CartItem;
  onQty: (qty: number) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const unit = Number(item.unitPriceCents ?? 0);
  const safeUnit = unit > 0 ? unit : null;
  const lineSubtotal = (safeUnit ?? 0) * item.qty;
  const lowStock = typeof item.availableStock === "number" && item.availableStock < item.qty;

  return (
    <article className="grid gap-3 rounded-xl border border-uiBorder bg-white p-3 md:grid-cols-[72px_1fr_auto] md:items-center">
      <div className="relative h-[72px] w-[72px] overflow-hidden rounded-md bg-surfaceMuted">
        <ProductImage src={item.imageUrl} alt={item.name ?? "Product"} fill sizes="72px" className="object-cover" />
      </div>

      <div className="min-w-0">
        <p className="truncate font-semibold text-brand-ink">{item.name ?? "Product"}</p>
        <p className="text-xs text-mutedText">{item.variantName || item.sku || "Standard item"}</p>
        <p className="mt-1 text-sm text-mutedText">
          Unit price: <span className="font-semibold text-brand-primary">{safeUnit ? formatCurrency(safeUnit) : "Price finalized at checkout"}</span>
        </p>
        <p className="text-sm text-mutedText">Line total: <span className="font-semibold">{safeUnit ? formatCurrency(lineSubtotal) : "—"}</span></p>
        {lowStock ? <p className="mt-1 text-xs font-medium text-amber-700">Limited stock available for selected quantity.</p> : null}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-uiBorder">
          <button disabled={disabled} type="button" onClick={() => onQty(Math.max(1, item.qty - 1))} className="px-2 py-1 text-sm hover:bg-surfaceMuted disabled:opacity-40" aria-label="Decrease quantity">−</button>
          <input
            type="number"
            min={1}
            value={item.qty}
            disabled={disabled}
            onChange={(event) => onQty(Math.max(1, Number(event.target.value) || 1))}
            className="w-12 border-x border-uiBorder p-1 text-center text-sm focus:outline-none"
            aria-label="Quantity"
          />
          <button disabled={disabled} type="button" onClick={() => onQty(item.qty + 1)} className="px-2 py-1 text-sm hover:bg-surfaceMuted disabled:opacity-40" aria-label="Increase quantity">+</button>
        </div>
        <button disabled={disabled} onClick={onRemove} className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40">
          Remove
        </button>
      </div>
    </article>
  );
}
