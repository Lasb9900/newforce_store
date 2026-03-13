"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { US_STATES } from "@/lib/us-address";

type Props = {
  value: string;
  onChange: (code: string) => void;
  error?: string;
  disabled?: boolean;
};

export function StateSelector({ value, onChange, error, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => US_STATES.find((state) => state.code === value), [value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return US_STATES;
    return US_STATES.filter((state) => `${state.name} ${state.code}`.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  function choose(index: number) {
    const option = filtered[index];
    if (!option) return;
    onChange(option.code);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((prev) => Math.min(filtered.length - 1, prev + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((prev) => Math.max(0, prev - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(highlighted);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id="field-state"
        role="combobox"
        aria-expanded={open}
        aria-controls="state-combobox-options"
        aria-invalid={Boolean(error)}
        aria-label="State"
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-uiBorder bg-white p-2 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:bg-surfaceMuted"
        placeholder={selected ? `${selected.name} (${selected.code})` : "Search state or code"}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onKeyDown={onKeyDown}
      />

      {open ? (
        <ul id="state-combobox-options" role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-uiBorder bg-white p-1 shadow-md">
          {filtered.map((state, index) => (
            <li key={state.code}>
              <button
                type="button"
                className={`w-full rounded px-2 py-1 text-left text-sm ${highlighted === index ? "bg-brand-primary/10 text-brand-primary" : "hover:bg-surface"}`}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(index)}
              >
                {state.name} ({state.code})
              </button>
            </li>
          ))}
          {!filtered.length ? <li className="px-2 py-1 text-sm text-mutedText">No matching states</li> : null}
        </ul>
      ) : null}

      {selected ? <p className="mt-1 text-xs text-mutedText">Selected: {selected.name} ({selected.code})</p> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
