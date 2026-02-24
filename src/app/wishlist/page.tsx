"use client";

import { useMemo } from "react";

export default function WishlistPage() {
  const items = useMemo(() => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("guest_wishlist") ?? "[]") as string[];
  }, []);
  return <div><h1 className="text-2xl font-bold">Wishlist</h1><pre>{JSON.stringify(items, null, 2)}</pre></div>;
}
