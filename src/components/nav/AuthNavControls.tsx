"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { WishlistBadgeLink } from "@/components/nav/WishlistBadgeLink";
import { CartBadgeLink } from "@/components/nav/CartBadgeLink";

export function AuthNavControls() {
  const initialize = useAuthStore((state) => state.initialize);
  const initialized = useAuthStore((state) => state.initialized);
  const userId = useAuthStore((state) => state.userId);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <>
      <WishlistBadgeLink />
      <CartBadgeLink />
      {initialized ? (
        userId ? <Link href="/account" className="rounded px-3 py-2 hover:bg-slate-100">Cuenta</Link> : <Link href="/login" className="rounded px-3 py-2 hover:bg-slate-100">Login</Link>
      ) : (
        <span className="rounded px-3 py-2 text-mutedText">...</span>
      )}
    </>
  );
}
