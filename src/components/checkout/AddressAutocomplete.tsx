"use client";

import { useEffect, useMemo, useState } from "react";
import { AddressSuggestion } from "@/lib/us-address";
import { autocompleteUsAddress } from "@/lib/services/address-autocomplete.service";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion: (suggestion: { line1: string; city: string; state: string; postal_code: string }) => void;
};

export function AddressAutocomplete({ value, onChange, onSelectSuggestion }: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const next = await autocompleteUsAddress(value);
      if (!cancelled) setSuggestions(next);
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  const hasSuggestions = useMemo(() => suggestions.length > 0, [suggestions.length]);

  return (
    <div>
      <input
        id="field-address_line_1"
        autoComplete="address-line1"
        className="mt-1 w-full rounded-lg border border-uiBorder bg-white p-2 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Street and number"
      />
      {hasSuggestions ? (
        <ul className="mt-2 rounded-lg border border-uiBorder bg-white p-1 text-sm shadow-sm" role="listbox" aria-label="Address suggestions">
          {suggestions.map((s, index) => (
            <li key={`${s.line1}-${s.city}-${index}`}>
              <button
                type="button"
                className="w-full rounded p-2 text-left hover:bg-surface"
                onClick={() => onSelectSuggestion(s)}
              >
                {s.line1}, {s.city} {s.state} {s.postal_code}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
