"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { useAuthStore } from "@/lib/auth-store";

export function WishlistBadgeLink() {
  const initialize = useWishlistStore((state) => state.initialize);
  const initialized = useWishlistStore((state) => state.initialized);
  const initializing = useWishlistStore((state) => state.initializing);
  const count = useWishlistStore((state) => state.items.length);
  const initAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initAuth();
    void initialize();
  }, [initAuth, initialize]);

  return (
    <Link href="/wishlist" className="relative rounded px-3 py-1.5 hover:bg-white/10">
      Wishlist
      <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-secondary px-1.5 text-xs font-semibold text-white">
        {initialized && !initializing ? count : "…"}
      </span>
    </Link>
  );
}
