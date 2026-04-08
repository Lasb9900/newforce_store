"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  productId: string;
  isAuthenticated: boolean;
  canReview: boolean;
  existingReview?: {
    rating: number;
    comment: string;
    status: string;
  } | null;
};

function renderStars(rating: number) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export default function ProductReviewForm({
  productId,
  isAuthenticated,
  canReview,
  existingReview,
}: Props) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(existingReview?.rating ?? 5);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const helperText = useMemo(() => {
    if (!isAuthenticated) return "Sign in to leave a verified review.";
    if (!canReview) return "Only customers with a paid purchase of this product can leave a review.";
    if (existingReview) {
      return `You already left a review for this product. You can update it here. Current status: ${existingReview.status}.`;
    }
    return "Share your experience with this product.";
  }, [isAuthenticated, canReview, existingReview]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAuthenticated || !canReview || saving) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          comment,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const serverError =
          typeof payload?.error === "string"
            ? payload.error
            : payload?.error?.formErrors?.[0] || "Could not save review.";
        setError(serverError);
        return;
      }

      setMessage(existingReview ? "Your review was updated." : "Your review was published.");
      router.refresh();
    } catch {
      setError("Could not save review right now.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-uiBorder bg-surface p-5 shadow-sm"
    >
      <div>
        <h3 className="text-lg font-semibold text-brand-ink">Write a review</h3>
        <p className="mt-1 text-sm text-mutedText">{helperText}</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-brand-ink">Rating</label>
        <div className="flex flex-wrap gap-2">
          {[5, 4, 3, 2, 1].map((value) => {
            const active = rating === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                disabled={!isAuthenticated || !canReview || saving}
                className={`rounded-full border px-3 py-2 text-sm transition ${
                  active
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-uiBorder bg-white text-brand-ink hover:border-brand-primary"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {renderStars(value)}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block text-sm font-medium text-brand-ink">
        Comment
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={5}
          minLength={3}
          maxLength={1000}
          required
          disabled={!isAuthenticated || !canReview || saving}
          placeholder="Tell other customers about your experience with this product."
          className="mt-2 w-full rounded-xl border border-uiBorder bg-white p-3 text-sm outline-none transition focus:border-brand-primary"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!isAuthenticated || !canReview || saving || comment.trim().length < 3}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : existingReview ? "Update review" : "Publish review"}
        </button>

        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </form>
  );
}