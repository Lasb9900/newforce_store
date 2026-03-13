import { formatCurrency } from "@/lib/utils";
import { CartItem } from "@/lib/types";

export function OrderSummary({
  items,
  subtotal,
  shipping,
  tax,
  loading,
}: {
  items: CartItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  loading?: boolean;
}) {
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  const total = subtotal + shipping + tax;

  return (
    <aside className="sticky top-4 space-y-4 rounded-2xl border border-uiBorder bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">4. Order summary</h2>
      <p className="text-sm text-mutedText">{itemCount} item{itemCount === 1 ? "" : "s"} in your order</p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-mutedText">Subtotal</span><span>{loading ? "…" : formatCurrency(subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-mutedText">Shipping</span><span>{loading ? "…" : shipping === 0 ? "Free" : formatCurrency(shipping)}</span></div>
        <div className="flex justify-between"><span className="text-mutedText">Estimated tax</span><span>{formatCurrency(tax)}</span></div>
        <div className="flex justify-between"><span className="text-mutedText">Discount</span><span>$0.00</span></div>
      </div>
      <div className="border-t border-uiBorder pt-3">
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span className="text-brand-primary">{formatCurrency(Math.max(total, 0))}</span>
        </div>
      </div>
      <div className="space-y-1 text-xs text-mutedText">
        <p>Secure payment processing.</p>
        <p>Shipping calculated before payment.</p>
      </div>
      <div className="rounded-lg bg-surface p-2 text-xs text-mutedText">Accepted payments: Visa • Mastercard • Amex • Apple Pay</div>
    </aside>
  );
}
