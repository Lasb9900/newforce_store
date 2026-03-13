"use client";

import { useEffect } from "react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { useAuthStore } from "@/lib/auth-store";

type Props = { productId: string };

export function WishlistToggleButton({ productId }: Props) {
  const initialize = useWishlistStore((state) => state.initialize);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist(productId));
  const toggle = useWishlistStore((state) => state.toggle);
  const syncing = useWishlistStore((state) => state.syncing);
  const currentUserId = useAuthStore((state) => state.userId);
  const initAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initAuth();
    void initialize();
  }, [initAuth, initialize]);

  return (
    <button
      type="button"
      disabled={syncing}
      onClick={() => void toggle(productId)}
      aria-label={currentUserId ? (isInWishlist ? "Remove from wishlist" : "Add to wishlist") : "Login required for wishlist"}
      title={currentUserId ? undefined : "Login required"}
      className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-700 shadow-sm transition hover:scale-105 disabled:opacity-60"
    >
      {isInWishlist ? "♥" : "♡"}
    </button>
  );
}
