"use client";

import { useMemo, useState } from "react";
import { US_STATES } from "@/lib/us-address";

type Props = {
  value: string;
  onChange: (code: string) => void;
  error?: string;
};

export function StateSelector({ value, onChange, error }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return US_STATES;
    return US_STATES.filter((state) => `${state.name} ${state.code}`.toLowerCase().includes(q));
  }, [query]);

  return (
    <div>
      <input
        aria-label="Search state"
        className="mt-1 w-full rounded-lg border border-uiBorder bg-white p-2 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        placeholder="Search state"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        id="field-state"
        aria-invalid={Boolean(error)}
        className="mt-2 w-full rounded-lg border border-uiBorder bg-white p-2 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select state</option>
        {filtered.map((state) => (
          <option key={state.code} value={state.code}>
            {state.name} ({state.code})
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
