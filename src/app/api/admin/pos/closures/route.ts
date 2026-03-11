import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createPosClosureSchema } from "@/lib/schemas";
import { fetchPosSalesRange, sumPosTotals } from "@/lib/pos";

const POS_CLOSURES_TABLE = "pos_cash_closures";

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

  console.log("[POS_CLOSURE] target table:", POS_CLOSURES_TABLE);

  const { data: existing } = await service
    .from(POS_CLOSURES_TABLE)
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

  const { data: pendingSalesForTotals } = await fetchPosSalesRange(fromIso, toIso, undefined, undefined, undefined, true);
  const totals = sumPosTotals(pendingSalesForTotals ?? []);

  const payload = {
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
  };

  console.log("[POS_CLOSURE] payload to insert:", payload);

  const { data: closure, error: closureError } = await service
    .from(POS_CLOSURES_TABLE)
    .insert(payload)
    .select("id")
    .single();

  console.log("[POS_CLOSURE] insert result:", closure ?? null);

  if (closureError || !closure) {
    console.log("[POS_CLOSURE] error:", closureError?.message ?? "No closure returned");
    return NextResponse.json({ error: closureError?.message || "No se pudo crear cierre" }, { status: 500 });
  }

  let pendingRowsResult = await service
    .from("pos_sales")
    .select("id,order_id")
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .is("cash_closure_id", null);

  if (pendingRowsResult.error?.message?.includes("column pos_sales.order_id does not exist")) {
    pendingRowsResult = await service
      .from("pos_sales")
      .select("id")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .is("cash_closure_id", null);
  }

  if (pendingRowsResult.error) {
    console.log("[POS_CLOSURE] error:", pendingRowsResult.error.message);
    return NextResponse.json({ error: `Cierre creado pero no se pudieron leer ventas pendientes: ${pendingRowsResult.error.message}` }, { status: 500 });
  }

  const pendingRows = pendingRowsResult.data ?? [];
  const pendingSaleIds = pendingRows.map((row) => row.id);
  console.log("[POS_CLOSURE] pending sales count:", pendingSaleIds.length);

  if (pendingSaleIds.length > 0) {
    const { data: markedRows, error: markClosedError } = await service
      .from("pos_sales")
      .update({ cash_closure_id: closure.id, closed_at: payload.closed_at })
      .in("id", pendingSaleIds)
      .is("cash_closure_id", null)
      .select("id");

    if (markClosedError) {
      console.log("[POS_CLOSURE] error:", markClosedError.message);
      return NextResponse.json({ error: `Cierre creado pero no se pudieron marcar ventas: ${markClosedError.message}` }, { status: 500 });
    }

    console.log("[POS_CLOSURE] marked sales count:", markedRows?.length ?? 0);
  }

  const uniqueOrderIds = [
    ...new Set(
      pendingRows
        .map((row) => ("order_id" in row ? (row as { order_id?: string | null }).order_id : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (uniqueOrderIds.length > 0) {
    const linkRows = uniqueOrderIds.map((saleOrderId) => ({ closure_id: closure.id, sale_order_id: saleOrderId }));
    const { error: linkErr } = await service.from("pos_cash_closure_sales").insert(linkRows);
    if (linkErr) {
      console.log("[POS_CLOSURE] error:", linkErr.message);
      return NextResponse.json({ error: `Cierre creado pero no se pudieron asociar ventas: ${linkErr.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, id: closure.id });
}
