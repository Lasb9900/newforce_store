"use client";

import { useMemo, useState } from "react";

type Props = {
  from: string;
  to: string;
  expectedCashCents: number;
  expectedCardCents: number;
  expectedTransferCents: number;
};

function toMoney(cents: number) {
  return new Intl.NumberFormat("es-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function ClosureForm({ from, to, expectedCashCents, expectedCardCents, expectedTransferCents }: Props) {
  const [actualCash, setActualCash] = useState((expectedCashCents / 100).toFixed(2));
  const [actualCard, setActualCard] = useState((expectedCardCents / 100).toFixed(2));
  const [actualTransfer, setActualTransfer] = useState((expectedTransferCents / 100).toFixed(2));
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const diffs = useMemo(() => {
    const ac = Math.round(Number(actualCash || 0) * 100);
    const ad = Math.round(Number(actualCard || 0) * 100);
    const at = Math.round(Number(actualTransfer || 0) * 100);
    return {
      cash: ac - expectedCashCents,
      card: ad - expectedCardCents,
      transfer: at - expectedTransferCents,
    };
  }, [actualCash, actualCard, actualTransfer, expectedCashCents, expectedCardCents, expectedTransferCents]);

  async function submit() {
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      const fromInput = (document.querySelector('input[name="from"]') as HTMLInputElement | null)?.value || from;
      const toInput = (document.querySelector('input[name="to"]') as HTMLInputElement | null)?.value || to;
      const payloadFromDate = new Date(`${fromInput}T00:00:00.000Z`).toISOString();
      const payloadToDate = new Date(`${toInput}T23:59:59.999Z`).toISOString();

      console.log("[POS_CLOSURE] ui fromDate:", fromInput);
      console.log("[POS_CLOSURE] ui toDate:", toInput);
      console.log("[POS_CLOSURE] payload from_date:", payloadFromDate);
      console.log("[POS_CLOSURE] payload to_date:", payloadToDate);

      const res = await fetch("/api/admin/pos/closures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromDate: payloadFromDate,
          toDate: payloadToDate,
          actualCashCents: Math.round(Number(actualCash || 0) * 100),
          actualCardCents: Math.round(Number(actualCard || 0) * 100),
          actualTransferCents: Math.round(Number(actualTransfer || 0) * 100),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "No se pudo registrar el cierre");
        return;
      }
      setMsg(`Cierre registrado: ${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-uiBorder bg-surface p-4">
      <h2 className="text-lg font-bold">Conciliación y registro</h2>
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-sm">Efectivo real<input className="mt-1 w-full rounded border border-uiBorder p-2" type="number" min={0} step="0.01" value={actualCash} onChange={(e) => setActualCash(e.target.value)} /></label>
        <label className="text-sm">Tarjeta real<input className="mt-1 w-full rounded border border-uiBorder p-2" type="number" min={0} step="0.01" value={actualCard} onChange={(e) => setActualCard(e.target.value)} /></label>
        <label className="text-sm">Transferencia real<input className="mt-1 w-full rounded border border-uiBorder p-2" type="number" min={0} step="0.01" value={actualTransfer} onChange={(e) => setActualTransfer(e.target.value)} /></label>
      </div>
      <div className="grid gap-2 text-sm md:grid-cols-3">
        <p>Dif. efectivo: <strong>{toMoney(diffs.cash)}</strong></p>
        <p>Dif. tarjeta: <strong>{toMoney(diffs.card)}</strong></p>
        <p>Dif. transferencia: <strong>{toMoney(diffs.transfer)}</strong></p>
      </div>
      <textarea className="w-full rounded border border-uiBorder p-2" placeholder="Observaciones" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? "Registrando..." : "Registrar cierre de caja"}</button>
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
