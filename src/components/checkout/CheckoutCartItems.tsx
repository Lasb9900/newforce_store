import Link from "next/link";
import { CartItem } from "@/lib/types";
import { CartItemRow } from "@/components/CartItemRow";

export function CheckoutCartItems({
  items,
  onQty,
  onRemove,
}: {
  items: CartItem[];
  onQty: (index: number, qty: number) => void;
  onRemove: (index: number) => void;
}) {
  if (!items.length) {
    return (
      <section className="rounded-2xl border border-uiBorder bg-white p-6 text-center shadow-sm">
        <p className="text-base font-semibold text-brand-ink">Your cart is empty</p>
        <p className="mt-1 text-sm text-mutedText">Add items to continue your secure checkout.</p>
        <Link href="/shop" className="btn-primary mt-4 inline-flex">Continue shopping</Link>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-uiBorder bg-surface p-4 shadow-sm">
      <h2 className="text-lg font-semibold">1. Cart items</h2>
      <div className="space-y-2">
        {items.map((item, index) => (
          <CartItemRow key={`${item.productId}-${item.variantId}-${index}`} item={item} onQty={(qty) => onQty(index, qty)} onRemove={() => onRemove(index)} />
        ))}
      </div>
    </section>
  );
}
