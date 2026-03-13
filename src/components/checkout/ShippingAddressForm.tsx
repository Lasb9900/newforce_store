import { US_STATE_CODES } from "@/lib/us-address";
import { FieldErrors, ShippingForm } from "@/components/checkout/types";

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
    <section className="space-y-3 rounded-2xl border border-uiBorder bg-surface p-4 shadow-sm">
      <h2 className="text-lg font-semibold">2. Shipping address (United States)</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium">Full name
          <input id="field-full_name" autoComplete="name" className={fieldClass} value={value.full_name} onChange={(e) => onChange({ full_name: e.target.value })} placeholder="John Doe" />
          {errors.full_name ? <span className="text-xs text-red-600">{errors.full_name}</span> : null}
        </label>
        <label className="text-sm font-medium">Email
          <input id="field-email" autoComplete="email" type="email" className={fieldClass} value={value.email} onChange={(e) => onChange({ email: e.target.value })} placeholder="john@email.com" />
          {errors.email ? <span className="text-xs text-red-600">{errors.email}</span> : null}
        </label>
        <label className="text-sm font-medium">Phone
          <input id="field-phone" autoComplete="tel" className={fieldClass} value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="+1 305 555 1212" />
          {errors.phone ? <span className="text-xs text-red-600">{errors.phone}</span> : null}
        </label>
        <label className="text-sm font-medium">Address line 1
          <input id="field-address_line_1" autoComplete="address-line1" className={fieldClass} value={value.address_line_1} onChange={(e) => onChange({ address_line_1: e.target.value })} placeholder="Street and number" />
          {errors.address_line_1 ? <span className="text-xs text-red-600">{errors.address_line_1}</span> : null}
        </label>
        <label className="text-sm font-medium">Address line 2 (optional)
          <input autoComplete="address-line2" className={fieldClass} value={value.address_line_2} onChange={(e) => onChange({ address_line_2: e.target.value })} placeholder="Apartment, suite, etc." />
        </label>
        <label className="text-sm font-medium">City
          <input id="field-city" autoComplete="address-level2" className={fieldClass} value={value.city} onChange={(e) => onChange({ city: e.target.value })} placeholder="Miami" />
          {errors.city ? <span className="text-xs text-red-600">{errors.city}</span> : null}
        </label>
        <label className="text-sm font-medium">State
          <select id="field-state" autoComplete="address-level1" className={fieldClass} value={value.state} onChange={(e) => onChange({ state: e.target.value })}>
            <option value="">Select state</option>
            {US_STATE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
          {errors.state ? <span className="text-xs text-red-600">{errors.state}</span> : null}
        </label>
        <label className="text-sm font-medium">ZIP code
          <input id="field-postal_code" autoComplete="postal-code" className={fieldClass} value={value.postal_code} onChange={(e) => onChange({ postal_code: e.target.value })} placeholder="33101" />
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
