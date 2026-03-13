"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";

export function CartBadgeLink() {
  const items = useCartStore((state) => state.items);
  const initialized = useCartStore((state) => state.initialized);
  const initializing = useCartStore((state) => state.initializing);
  const initialize = useCartStore((state) => state.initialize);
  const initAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initAuth();
    void initialize();
  }, [initAuth, initialize]);

  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const showCount = initialized && !initializing;

  return (
    <Link href="/cart" className="relative rounded px-3 py-1.5 hover:bg-white/10">
      Cart
      <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-accent px-1.5 text-xs font-semibold text-white">
        {showCount ? count : "…"}
      </span>
    </Link>
  );
}
