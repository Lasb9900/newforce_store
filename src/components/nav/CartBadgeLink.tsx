"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCartStore } from "@/lib/cart-store";

export function CartBadgeLink() {
  const { items, hydrate } = useCartStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const count = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <Link href="/cart" className="relative rounded px-3 py-1.5 hover:bg-white/10">
      Cart
      <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-accent px-1.5 text-xs font-semibold text-white">
        {count}
      </span>
    </Link>
  );
}
