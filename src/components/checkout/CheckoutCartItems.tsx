import Link from "next/link";
import { CartItem } from "@/lib/types";
import { CartItemRow } from "@/components/CartItemRow";
import { cartItemKey } from "@/lib/cart-store";

export function CheckoutCartItems({
  items,
  onQty,
  onRemove,
  disabled,
}: {
  items: CartItem[];
  onQty: (itemKey: string, qty: number) => void;
  onRemove: (itemKey: string) => void;
  disabled?: boolean;
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
        {items.map((item) => {
          const key = cartItemKey(item);
          return <CartItemRow key={key} item={item} disabled={disabled} onQty={(qty) => onQty(key, qty)} onRemove={() => onRemove(key)} />;
        })}
      </div>
    </section>
  );
}
