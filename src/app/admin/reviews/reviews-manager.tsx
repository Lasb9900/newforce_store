"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ReviewItem = {
  id: string;
  comment: string;
  rating: number;
  status: string;
  productId: string;
  createdAt: string;
  productName: string;
  productSku: string | null;
};

type Props = {
  reviews: ReviewItem[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusBadgeClass(status: string) {
  if (status === "visible") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (status === "hidden") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function ReviewsManager({ reviews }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    return {
      total: reviews.length,
      visible: reviews.filter((review) => review.status === "visible").length,
      hidden: reviews.filter((review) => review.status === "hidden").length,
    };
  }, [reviews]);

  async function updateStatus(reviewId: string, nextStatus: "visible" | "hidden") {
    setBusyId(reviewId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload?.error || "No se pudo actualizar el review.");
        return;
      }

      router.refresh();
    } catch {
      setError("No se pudo actualizar el review.");
    } finally {
      setBusyId(null);
    }
  }

  if (!reviews.length) {
    return (
      <div className="rounded-lg border border-dashed border-uiBorder p-6 text-sm text-mutedText">
        No hay reviews registrados todavía.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-lg border border-uiBorder bg-surfaceMuted p-4">
          <p className="text-xs uppercase tracking-wide text-mutedText">Total reviews</p>
          <p className="mt-1 text-2xl font-bold text-brand-ink">{totals.total}</p>
        </article>

        <article className="rounded-lg border border-uiBorder bg-surfaceMuted p-4">
          <p className="text-xs uppercase tracking-wide text-mutedText">Visibles</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{totals.visible}</p>
        </article>

        <article className="rounded-lg border border-uiBorder bg-surfaceMuted p-4">
          <p className="text-xs uppercase tracking-wide text-mutedText">Ocultos</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{totals.hidden}</p>
        </article>
      </div>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {reviews.map((review) => {
          const isVisible = review.status === "visible";
          const isBusy = busyId === review.id;

          return (
            <article
              key={review.id}
              className="rounded-xl border border-uiBorder bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-brand-ink">
                      {review.productName}
                    </h2>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(review.status)}`}
                    >
                      {review.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-mutedText">
                    <p>
                      <span className="font-medium text-brand-ink">Producto ID:</span>{" "}
                      {review.productId}
                    </p>

                    {review.productSku ? (
                      <p>
                        <span className="font-medium text-brand-ink">SKU:</span>{" "}
                        {review.productSku}
                      </p>
                    ) : null}

                    <p>
                      <span className="font-medium text-brand-ink">Fecha:</span>{" "}
                      {formatDate(review.createdAt)}
                    </p>

                    <p>
                      <span className="font-medium text-brand-ink">Rating:</span>{" "}
                      {review.rating}/5
                    </p>
                  </div>

                  <p className="rounded-lg border border-uiBorder bg-surface px-3 py-3 text-sm leading-6 text-brand-ink">
                    {review.comment}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/product/${review.productId}`}
                    target="_blank"
                    className="rounded-lg border border-uiBorder px-3 py-2 text-sm font-medium text-brand-ink transition hover:border-brand-primary hover:text-brand-primary"
                  >
                    Ver producto
                  </Link>

                  {isVisible ? (
                    <button
                      type="button"
                      onClick={() => updateStatus(review.id, "hidden")}
                      disabled={isBusy}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy ? "Ocultando..." : "Ocultar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateStatus(review.id, "visible")}
                      disabled={isBusy}
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy ? "Activando..." : "Mostrar"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}