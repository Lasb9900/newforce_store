type StockBadgeProps = {
  stock: number;
};

export function StockBadge({ stock }: StockBadgeProps) {
  if (stock <= 0) {
    return <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">Out of stock</span>;
  }

  if (stock <= 5) {
    return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">Low stock</span>;
  }

  return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">In stock</span>;
}
