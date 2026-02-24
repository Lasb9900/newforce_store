"use client";

import { ProductVariant } from "@/lib/types";

export function VariantSelector({
  variants,
  value,
  onChange,
}: {
  variants: ProductVariant[];
  value?: string;
  onChange: (variantId: string) => void;
}) {
  return (
    <select className="w-full rounded border p-2" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecciona variante</option>
      {variants.map((variant) => (
        <option key={variant.id} value={variant.id}>
          {variant.variant_name} · Stock {variant.stock}
        </option>
      ))}
    </select>
  );
}
