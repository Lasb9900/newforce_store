const BADGES = ["🔒 Secure Checkout", "💳 Secure Payment", "⚡ Fast Shipping USA", "✔ Easy Returns"];

export function CheckoutTrustBadges() {
  return (
    <div className="flex flex-wrap gap-2">
      {BADGES.map((badge) => (
        <span key={badge} className="rounded-full border border-uiBorder bg-surface px-3 py-1 text-xs font-medium text-mutedText">
          {badge}
        </span>
      ))}
    </div>
  );
}
