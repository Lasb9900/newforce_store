"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";

export default function SuccessPage() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const initialize = useCartStore((state) => state.initialize);
  const clear = useCartStore((state) => state.clear);

  useEffect(() => {
    let mounted = true;

    async function clearCompletedCart() {
      await initialize();
      if (!mounted) return;
      await clear();
    }

    void clearCompletedCart();
    return () => {
      mounted = false;
    };
  }, [clear, initialize]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Pago exitoso</h1>
      <p className="text-sm text-mutedText">Tu pedido fue confirmado y tu carrito se limpió correctamente.</p>
      <p className="mt-2 text-xs text-mutedText">Session: {sessionId ?? "N/A"}</p>
    </div>
  );
}
