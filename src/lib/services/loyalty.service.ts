import "server-only";

import { getServiceSupabase } from "@/lib/supabase";

export type LoyaltySourceType = "online_order" | "pos_sale";

type LoyaltyRpcPayload = {
  status?: string;
  points_awarded?: number;
  message?: string;
};

export function normalizeCustomerEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized.length ? normalized : null;
}

export async function processLoyaltyAccrual(input: {
  sourceType: LoyaltySourceType;
  sourceId: string;
  amountCents: number;
  email?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  let admin: ReturnType<typeof getServiceSupabase>;
  try {
    admin = getServiceSupabase();
  } catch (error) {
    return {
      status: "error" as const,
      pointsAwarded: 0,
      error: error instanceof Error ? error.message : "Unable to initialize Supabase admin client",
    };
  }

  const normalizedEmail = normalizeCustomerEmail(input.email);

  const rpcParams = {
    p_amount_cents: Math.max(0, Math.floor(input.amountCents ?? 0)),
    p_email: normalizedEmail,
    p_metadata: input.metadata ?? {},
    p_source_id: input.sourceId,
    p_source_type: input.sourceType,
    p_user_id: input.userId ?? null,
  };

  const { data, error } = await admin.rpc("process_loyalty_accrual", rpcParams);

  if (error) {
    return {
      status: "error" as const,
      pointsAwarded: 0,
      error: error.message || "Failed to execute process_loyalty_accrual",
    };
  }

  const payload = (Array.isArray(data) ? data[0] : data) as LoyaltyRpcPayload | null;
  const status = (payload?.status as string | undefined) ?? "error";
  const pointsAwarded = Number(payload?.points_awarded ?? 0);

  return {
    status,
    pointsAwarded,
    error: status === "error" ? payload?.message ?? "Unknown loyalty error" : null,
  };
}
