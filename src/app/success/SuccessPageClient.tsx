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
  <section className="mx-auto max-w-xl px-4 py-16 text-center">
    
    {/* ICONO */}
    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
      <svg
        className="h-8 w-8 text-green-600"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>

    {/* TITULO */}
    <h1 className="text-3xl font-bold tracking-tight">
      {state === "paid"
        ? "Pago confirmado"
        : state === "processing"
        ? "Procesando tu pago"
        : state === "error"
        ? "Ocurrió un problema"
        : "Validando pago"}
    </h1>

    {/* DESCRIPCION */}
    <p className="mt-3 text-sm text-mutedText">
      {state === "paid" &&
        "Tu pedido fue procesado correctamente. Recibirás una confirmación por correo."}

      {state === "processing" &&
        "Estamos terminando de confirmar tu pago. Esto puede tomar unos segundos."}

      {state === "loading" &&
        "Estamos verificando la confirmación con Stripe."}

      {state === "error" &&
        "No pudimos confirmar tu pago en este momento."}

      {state === "invalid" &&
        "No encontramos información válida para esta sesión."}
    </p>

    {/* CARD INFO */}
    {(details?.orderId || sessionId) && (
      <div className="mt-8 rounded-xl border bg-white p-6 text-left shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-500">
          Detalles del pedido
        </h2>

        {details?.orderId && (
          <div className="flex justify-between text-sm mb-2">
            <span className="text-mutedText">Orden</span>
            <span className="font-medium">{details.orderId}</span>
          </div>
        )}

        {details?.stripePaymentStatus && (
          <div className="flex justify-between text-sm mb-2">
            <span className="text-mutedText">Estado</span>
            <span className="font-medium text-green-600">
              {details.stripePaymentStatus}
            </span>
          </div>
        )}

        {sessionId && (
          <div className="flex justify-between text-sm">
            <span className="text-mutedText">Session</span>
            <span className="font-mono text-xs truncate max-w-[200px]">
              {sessionId}
            </span>
          </div>
        )}
      </div>
    )}

    {/* BOTONES */}
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <a
        href="/shop"
        className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white hover:opacity-90 transition"
      >
        Seguir comprando
      </a>

      <a
        href="/account/orders"
        className="rounded-lg border px-6 py-3 text-sm font-medium hover:bg-gray-50 transition"
      >
        Ver mis pedidos
      </a>
    </div>
  </section>
);
}