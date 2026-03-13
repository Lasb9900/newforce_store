export function CheckoutActions({
  disabled,
  loading,
  missingShipping,
  onCheckout,
}: {
  disabled: boolean;
  loading: boolean;
  missingShipping: boolean;
  onCheckout: () => void;
}) {
  let text = "Continue to payment";
  if (missingShipping) text = "Select shipping method first";
  if (loading) text = "Processing secure checkout...";

  return (
    <div className="space-y-2">
      <button type="button" onClick={onCheckout} disabled={disabled} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? <span className="inline-flex items-center gap-2"><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />{text}</span> : text}
      </button>
      <p className="text-center text-xs text-mutedText">You’ll be redirected to Stripe to complete payment securely.</p>
    </div>
  );
}
