const BADGES = ["SSL Secure", "Secure Payment", "Stripe Protected", "Fast Shipping in USA"];

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
