"use client";

import { useEffect, useRef, useState } from "react";
import { useCartStore } from "@/lib/cart-store";

type SuccessPageClientProps = {
  sessionId: string | null;
};

type VerifyResponse = {
  ok?: boolean;
  status?: "paid" | "processing" | "pending" | "not_found";
  orderId?: string;
  sessionId?: string;
  stripePaymentStatus?: string | null;
  orderStatus?: string | null;
  orderPaymentStatus?: string | null;
  error?: string;
  message?: string;
};

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2000;
const GUEST_CART_KEY = "cart:guest";

export default function SuccessPageClient({
  sessionId,
}: SuccessPageClientProps) {
  const initialize = useCartStore((state) => state.initialize);
  const currentUserId = useCartStore((state) => state.currentUserId);

  const [state, setState] = useState<
    "loading" | "paid" | "processing" | "invalid" | "error"
  >(sessionId ? "loading" : "invalid");

  const [details, setDetails] = useState<VerifyResponse | null>(null);
  const handledPaidRef = useRef(false);

useEffect(() => {
  if (!sessionId) return;

  const verifiedSessionId = sessionId;
  let cancelled = false;

  async function syncCartAfterVerifiedPayment() {
    if (handledPaidRef.current) return;
    handledPaidRef.current = true;

    try {
      if (!currentUserId && typeof window !== "undefined") {
        localStorage.removeItem(GUEST_CART_KEY);
      }

      useCartStore.setState({
        items: [],
        notice: null,
      });

      await initialize();
    } catch (error) {
      console.error("[SUCCESS_PAGE][CART_SYNC_ERROR]", error);
    }
  }

  async function verifyLoop() {
    for (let attempt = 1; attempt <= MAX_POLLS; attempt += 1) {
      try {
        const response = await fetch(
          `/api/stripe/verify-session?session_id=${encodeURIComponent(verifiedSessionId)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = (await response.json()) as VerifyResponse;

        if (cancelled) return;

        setDetails(data);

        if (!response.ok) {
          if (response.status === 404) {
            setState("invalid");
            return;
          }

          setState("error");
          return;
        }

        if (data.status === "paid") {
          setState("paid");
          await syncCartAfterVerifiedPayment();
          return;
        }

        if (data.status === "processing") {
          setState("processing");
        } else {
          setState("loading");
        }
      } catch (error) {
        console.error("[SUCCESS_PAGE][VERIFY_ERROR]", error);

        if (cancelled) return;
        setState("error");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (!cancelled) {
      setState("processing");
    }
  }

  void verifyLoop();

  return () => {
    cancelled = true;
  };
}, [currentUserId, initialize, sessionId]);

  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      {state === "loading" && (
        <>
          <h1 className="text-2xl font-bold">Estamos confirmando tu pago</h1>
          <p className="mt-2 text-sm text-mutedText">
            Recibimos tu regreso desde Stripe. Ahora estamos verificando la
            confirmación final de tu pedido.
          </p>
        </>
      )}

      {state === "processing" && (
        <>
          <h1 className="text-2xl font-bold">
            Tu pago está en proceso de confirmación
          </h1>
          <p className="mt-2 text-sm text-mutedText">
            Stripe reportó la sesión correctamente, pero el sistema aún está
            terminando de reflejar la orden como pagada.
          </p>
        </>
      )}

      {state === "paid" && (
        <>
          <h1 className="text-2xl font-bold">Pago exitoso</h1>
          <p className="mt-2 text-sm text-mutedText">
            Tu pedido fue confirmado correctamente.
          </p>
        </>
      )}

      {state === "invalid" && (
        <>
          <h1 className="text-2xl font-bold">No pudimos validar este pago</h1>
          <p className="mt-2 text-sm text-mutedText">
            Esta página no tiene una sesión válida de Stripe o la orden no fue
            encontrada.
          </p>
        </>
      )}

      {state === "error" && (
        <>
          <h1 className="text-2xl font-bold">
            Ocurrió un problema al validar tu pago
          </h1>
          <p className="mt-2 text-sm text-mutedText">
            No pudimos confirmar el estado final de la orden desde esta página.
          </p>
        </>
      )}

      {sessionId && (
        <p className="mt-4 break-all text-xs text-mutedText">
          Session: {sessionId}
        </p>
      )}

      {details?.orderId && (
        <p className="mt-2 text-xs text-mutedText">Orden: {details.orderId}</p>
      )}

      {details?.stripePaymentStatus && (
        <p className="mt-1 text-xs text-mutedText">
          Stripe payment status: {details.stripePaymentStatus}
        </p>
      )}
    </section>
  );
}