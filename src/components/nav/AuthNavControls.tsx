"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { WishlistBadgeLink } from "@/components/nav/WishlistBadgeLink";
import { CartBadgeLink } from "@/components/nav/CartBadgeLink";

export function AuthNavControls() {
  const pathname = usePathname();
  const initialize = useAuthStore((state) => state.initialize);
  const refresh = useAuthStore((state) => state.refresh);
  const initialized = useAuthStore((state) => state.initialized);
  const userId = useAuthStore((state) => state.userId);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    console.info("[NAVBAR_DEBUG] render", { route: pathname, initialized, userId, status: userId ? "authenticated" : "guest", render: "client" });
  }, [initialized, pathname, userId]);

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
