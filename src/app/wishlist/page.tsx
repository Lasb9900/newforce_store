"use client";

import { useMemo } from "react";

export default function WishlistPage() {
  const items = useMemo(() => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("guest_wishlist") ?? "[]") as string[];
  }, []);

  return (
    <div className="rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <h1 className="text-2xl font-bold">Wishlist</h1>
      <p className="mb-4 text-sm text-mutedText">Tus productos guardados como invitado.</p>
      {items.length === 0 ? (
        <p className="text-mutedText">Aún no agregas productos a la wishlist.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((id) => (
            <li key={id} className="rounded-md border border-uiBorder bg-surfaceMuted px-3 py-2 text-sm">{id}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
