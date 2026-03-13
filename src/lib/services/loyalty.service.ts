import "server-only";

import { getServiceSupabase } from "@/lib/supabase";

export type LoyaltySourceType = "online_order" | "pos_sale";

type LoyaltyAccrualResult = {
  transaction_id: string;
  status: "pending" | "applied" | "duplicate" | "skipped_no_user" | "skipped_no_email" | "skipped_ineligible" | "error";
  points_awarded: number;
  resolved_user_id: string | null;
  normalized_email: string | null;
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
      data: null,
      error: {
        message: error instanceof Error ? error.message : "Unable to initialize Supabase admin client",
      },
    };
  }

  const normalizedEmail = normalizeCustomerEmail(input.email);

  const { data, error } = await admin.rpc("process_loyalty_accrual", {
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_email: normalizedEmail,
    p_amount_cents: Math.max(0, Math.floor(input.amountCents ?? 0)),
    p_user_id: input.userId ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    return {
      data: null,
      error: {
        ...error,
        message: error.message || "Failed to execute process_loyalty_accrual",
      },
    };
  }

  const payload = Array.isArray(data) ? data[0] : data;
  return { data: (payload as LoyaltyAccrualResult | null) ?? null, error: null };
}
