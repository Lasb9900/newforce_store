"use client";

import { ProductVariant } from "@/lib/types";

export function VariantSelector({ variants, value, onChange }: { variants: ProductVariant[]; value?: string; onChange: (variantId: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-brand-ink">Selecciona variante</label>
      <select
        className="w-full rounded-md border border-uiBorder bg-surface p-2.5 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecciona variante</option>
        {variants.map((variant) => (
          <option key={variant.id} value={variant.id}>
            {variant.variant_name} · Stock {variant.stock}
          </option>
        ))}
      </select>
    </div>
  );
}
