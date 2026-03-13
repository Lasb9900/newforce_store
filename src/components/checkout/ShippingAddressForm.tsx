import { FieldErrors, ShippingForm } from "@/components/checkout/types";
import { StateSelector } from "@/components/checkout/StateSelector";
import { AddressAutocomplete } from "@/components/checkout/AddressAutocomplete";

export function ShippingAddressForm({
  value,
  errors,
  onChange,
}: {
  value: ShippingForm;
  errors: FieldErrors;
  onChange: (patch: Partial<ShippingForm>) => void;
}) {
  const fieldClass = "mt-1 w-full rounded-lg border border-uiBorder bg-white p-2 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

  return (
    <section className="space-y-3 rounded-2xl border border-uiBorder bg-surface p-4 shadow-sm" aria-labelledby="shipping-address-title">
      <h2 id="shipping-address-title" className="text-lg font-semibold">2. Shipping address (United States)</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium">Full name
          <input id="field-full_name" autoComplete="name" aria-invalid={Boolean(errors.full_name)} className={fieldClass} value={value.full_name} onChange={(e) => onChange({ full_name: e.target.value })} placeholder="John Doe" />
          {errors.full_name ? <span className="text-xs text-red-600">{errors.full_name}</span> : null}
        </label>
        <label className="text-sm font-medium">Email
          <input id="field-email" autoComplete="email" type="email" aria-invalid={Boolean(errors.email)} className={fieldClass} value={value.email} onChange={(e) => onChange({ email: e.target.value })} placeholder="john@email.com" />
          {errors.email ? <span className="text-xs text-red-600">{errors.email}</span> : null}
        </label>
        <label className="text-sm font-medium">Phone
          <input id="field-phone" autoComplete="tel" aria-invalid={Boolean(errors.phone)} className={fieldClass} value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="+1 305 555 1212" />
          {errors.phone ? <span className="text-xs text-red-600">{errors.phone}</span> : null}
        </label>
        <label className="text-sm font-medium">Address line 1
          <AddressAutocomplete
            value={value.address_line_1}
            onChange={(next) => onChange({ address_line_1: next })}
            onSelectSuggestion={(s) => onChange({
              address_line_1: s.line1,
              city: s.city,
              state: s.state,
              postal_code: s.postal_code,
            })}
          />
          {errors.address_line_1 ? <span className="text-xs text-red-600">{errors.address_line_1}</span> : null}
        </label>
        <label className="text-sm font-medium">Address line 2 (optional)
          <input autoComplete="address-line2" className={fieldClass} value={value.address_line_2} onChange={(e) => onChange({ address_line_2: e.target.value })} placeholder="Apartment, suite, etc." />
        </label>
        <label className="text-sm font-medium">City
          <input id="field-city" autoComplete="address-level2" aria-invalid={Boolean(errors.city)} className={fieldClass} value={value.city} onChange={(e) => onChange({ city: e.target.value })} placeholder="Miami" />
          {errors.city ? <span className="text-xs text-red-600">{errors.city}</span> : null}
        </label>
        <label className="text-sm font-medium">State
          <StateSelector value={value.state} onChange={(state) => onChange({ state })} error={errors.state} />
        </label>
        <label className="text-sm font-medium">ZIP code
          <input id="field-postal_code" autoComplete="postal-code" aria-invalid={Boolean(errors.postal_code)} className={fieldClass} value={value.postal_code} onChange={(e) => onChange({ postal_code: e.target.value })} placeholder="33101" />
          {errors.postal_code ? <span className="text-xs text-red-600">{errors.postal_code}</span> : null}
        </label>
        <label className="text-sm font-medium">Country
          <input className={`${fieldClass} bg-surfaceMuted`} readOnly value="United States" />
        </label>
        <label className="text-sm font-medium md:col-span-2">Delivery notes (optional)
          <textarea className={fieldClass} value={value.delivery_notes} onChange={(e) => onChange({ delivery_notes: e.target.value })} placeholder="Gate code, drop-off instructions..." rows={3} />
        </label>
      </div>
    </section>
  );
}
