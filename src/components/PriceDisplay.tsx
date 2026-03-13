import { formatCurrency } from "@/lib/utils";

type PriceDisplayProps = {
  priceCents: number;
  compareAtPriceCents?: number | null;
};

export function PriceDisplay({ priceCents, compareAtPriceCents }: PriceDisplayProps) {
  const hasDiscount = !!compareAtPriceCents && compareAtPriceCents > priceCents;
  const discountPct = hasDiscount ? Math.round(((compareAtPriceCents - priceCents) / compareAtPriceCents) * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-bold text-brand-primary">{formatCurrency(priceCents)}</span>
      {hasDiscount ? (
        <>
          <span className="text-sm text-mutedText line-through">{formatCurrency(compareAtPriceCents)}</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">-{discountPct}%</span>
        </>
      ) : null}
    </div>
  );
}
