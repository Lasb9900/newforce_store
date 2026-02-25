"use client";

export function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="text-brand-accent" aria-label={`Rating ${rating}`}>
      {[1, 2, 3, 4, 5].map((v) => (
        <span key={v} className="text-lg">{v <= Math.round(rating) ? "★" : "☆"}</span>
      ))}
    </div>
  );
}
