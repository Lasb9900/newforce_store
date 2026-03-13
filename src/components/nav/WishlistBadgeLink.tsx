"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useWishlistStore } from "@/lib/wishlist-store";

export function WishlistBadgeLink() {
  const initialize = useWishlistStore((state) => state.initialize);
  const initialized = useWishlistStore((state) => state.initialized);
  const initializing = useWishlistStore((state) => state.initializing);
  const currentUserId = useWishlistStore((state) => state.currentUserId);
  const count = useWishlistStore((state) => state.items.length);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <Link href="/wishlist" className="relative rounded px-3 py-1.5 hover:bg-white/10">
      Wishlist
      <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-secondary px-1.5 text-xs font-semibold text-white">
        {initialized && !initializing ? (currentUserId ? count : 0) : "…"}
      </span>
    </Link>
  );
}
