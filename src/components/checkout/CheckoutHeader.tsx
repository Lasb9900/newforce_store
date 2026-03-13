export function CheckoutHeader() {
  return (
    <section className="rounded-2xl border border-uiBorder bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-brand-primary/10 px-2 py-1 text-brand-primary" aria-hidden>🔒</div>
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Secure Checkout</h1>
          <p className="text-sm text-mutedText">Your information is protected with SSL encryption.</p>
          <p className="mt-1 text-xs text-mutedText">Encrypted checkout • Fraud monitoring • Trusted payment rails</p>
        </div>
      </div>
    </section>
  );
}
