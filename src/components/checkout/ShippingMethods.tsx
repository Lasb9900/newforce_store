import { formatCurrency } from "@/lib/utils";
import { ShippingOption } from "@/components/checkout/types";

export function ShippingMethods({
  options,
  selectedId,
  loading,
  disabled,
  message,
  onCalculate,
  onSelect,
}: {
  options: ShippingOption[];
  selectedId: ShippingOption["id"] | "";
  loading: boolean;
  disabled: boolean;
  message?: string | null;
  onCalculate: () => void;
  onSelect: (id: ShippingOption["id"]) => void;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-uiBorder bg-surface p-4 shadow-sm">
      <h2 className="text-lg font-semibold">3. Shipping method</h2>
      <button type="button" onClick={onCalculate} disabled={disabled || loading} className="btn-secondary disabled:opacity-60">
        {loading ? "Calculating..." : "Calculate shipping"}
      </button>
      {message ? <p className="text-sm text-amber-700">{message}</p> : null}
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option.id} className="flex cursor-pointer items-start justify-between rounded-xl border border-uiBorder bg-white p-3">
            <span className="flex gap-2">
              <input type="radio" checked={selectedId === option.id} onChange={() => onSelect(option.id)} name="shipping-option" className="mt-1" />
              <span>
                <span className="block font-medium">{option.name}</span>
                <span className="block text-xs text-mutedText">{option.estimated_days}</span>
                {option.label ? <span className="mt-1 inline-block rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] font-medium text-brand-primary">{option.label}</span> : null}
              </span>
            </span>
            <span className="font-semibold">{option.amount_cents === 0 ? "Free" : formatCurrency(option.amount_cents)}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
