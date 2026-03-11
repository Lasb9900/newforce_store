import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createPosClosureSchema } from "@/lib/schemas";
import { fetchPosSalesRange, sumPosTotals } from "@/lib/pos";

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const parsed = createPosClosureSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const { fromDate, toDate, actualCashCents, actualCardCents, actualTransferCents, notes } = parsed.data;
  if (new Date(toDate).getTime() < new Date(fromDate).getTime()) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  const service = auth.supabase;

  const { data: existing } = await service
    .from("pos_cash_closures")
    .select("id")
    .eq("status", "closed")
    .lte("from_date", toDate)
    .gte("to_date", fromDate)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Ya existe un cierre para este rango" }, { status: 409 });
  }

  const fromIso = fromDate.length <= 10 ? new Date(`${fromDate}T00:00:00.000Z`).toISOString() : fromDate;
  const toIso = toDate.length <= 10 ? new Date(`${toDate}T23:59:59.999Z`).toISOString() : toDate;

  const { data: sales } = await fetchPosSalesRange(fromIso, toIso);
  const totals = sumPosTotals(sales ?? []);

  const { data: closure, error: closureError } = await service
    .from("pos_cash_closures")
    .insert({
      closed_at: new Date().toISOString(),
      closed_by: auth.user.id,
      from_date: fromDate,
      to_date: toDate,
      expected_cash: totals.cashCents,
      expected_card: totals.cardCents,
      expected_transfer: totals.transferCents,
      actual_cash: actualCashCents,
      actual_card: actualCardCents,
      actual_transfer: actualTransferCents,
      cash_difference: actualCashCents - totals.cashCents,
      card_difference: actualCardCents - totals.cardCents,
      transfer_difference: actualTransferCents - totals.transferCents,
      notes: notes?.trim() || null,
      status: "closed",
    })
    .select("id")
    .single();

  if (closureError || !closure) {
    return NextResponse.json({ error: closureError?.message || "No se pudo crear cierre" }, { status: 500 });
  }

  const uniqueOrderIds = [...new Set((sales ?? []).map((s) => s.order_id).filter((id): id is string => Boolean(id)))];
  if (uniqueOrderIds.length > 0) {
    const linkRows = uniqueOrderIds.map((saleOrderId) => ({ closure_id: closure.id, sale_order_id: saleOrderId }));
    const { error: linkErr } = await service.from("pos_cash_closure_sales").insert(linkRows);
    if (linkErr) {
      return NextResponse.json({ error: `Cierre creado pero no se pudieron asociar ventas: ${linkErr.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, id: closure.id });
}
