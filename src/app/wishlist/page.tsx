"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { formatCurrency } from "@/lib/utils";

export default function WishlistPage() {
  const initialize = useWishlistStore((state) => state.initialize);
  const initialized = useWishlistStore((state) => state.initialized);
  const syncing = useWishlistStore((state) => state.syncing);
  const currentUserId = useWishlistStore((state) => state.currentUserId);
  const items = useWishlistStore((state) => state.items);
  const notice = useWishlistStore((state) => state.notice);
  const dismissNotice = useWishlistStore((state) => state.dismissNotice);
  const toggle = useWishlistStore((state) => state.toggle);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <div className="rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <h1 className="text-2xl font-bold">Wishlist</h1>
      {notice ? <p className="mt-2 text-sm text-mutedText">{notice.message} <button className="underline" onClick={dismissNotice}>Dismiss</button></p> : null}

      {!initialized || syncing ? <p className="mt-4 text-sm text-mutedText">Syncing wishlist...</p> : null}

      {initialized && !currentUserId ? (
        <div className="mt-4 rounded-lg border border-uiBorder bg-white p-4 text-sm">
          <p className="text-mutedText">Debes iniciar sesión para usar wishlist.</p>
          <Link href="/login?next=/wishlist" className="btn-primary mt-3 inline-flex">Ir a login</Link>
        </div>
      ) : null}

      {initialized && currentUserId && !items.length ? (
        <div className="mt-4 rounded-lg border border-uiBorder bg-white p-4 text-sm text-mutedText">
          Aún no agregas productos a tu wishlist.
        </div>
      ) : null}

      {initialized && currentUserId && items.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-md border border-uiBorder bg-white px-3 py-2">
              <div>
                <p className="font-medium">{item.products?.name ?? item.product_id}</p>
                <p className="text-xs text-mutedText">{item.products?.base_price_cents ? formatCurrency(item.products.base_price_cents) : "Price at checkout"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/product/${item.product_id}`} className="btn-secondary text-sm">Ver</Link>
                <button className="text-xs text-red-600" onClick={() => void toggle(item.product_id)}>Quitar</button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
