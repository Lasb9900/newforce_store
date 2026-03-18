"use client";

import { useEffect, useRef } from "react";
import { useCartStore } from "@/lib/cart-store";

type SuccessPageClientProps = {
  sessionId: string | null;
};

export default function SuccessPageClient({
  sessionId,
}: SuccessPageClientProps) {
  const initialize = useCartStore((state) => state.initialize);
  const clear = useCartStore((state) => state.clear);
  const hasClearedRef = useRef(false);

  useEffect(() => {
    if (hasClearedRef.current) return;
    hasClearedRef.current = true;

    async function clearCompletedCart() {
      try {
        await initialize();
        await clear();
      } catch (error) {
        console.error("Failed to clear cart after successful checkout:", error);
      }
    }

    void clearCompletedCart();
  }, [clear, initialize]);

  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Pago exitoso</h1>
      <p className="mt-2 text-sm text-mutedText">
        Tu pedido fue confirmado y tu carrito se limpió correctamente.
      </p>

      {sessionId && (
        <p className="mt-3 text-xs text-mutedText">
          Session: {sessionId}
        </p>
      )}
    </section>
  );
}