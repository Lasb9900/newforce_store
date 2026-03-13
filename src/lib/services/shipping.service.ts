import { buildShippingOptions as buildMockShippingOptions, ShippingOption } from "@/lib/shipping";
import { getUpsRates } from "@/lib/adapters/ups.adapter";
import { env } from "@/lib/env";

type ShippingInput = {
  subtotalCents: number;
  destinationPostalCode: string;
  destinationState: string;
  destinationCountry: "US";
  weightGrams: number;
};

const ratesCache = new Map<string, { expiresAt: number; options: ShippingOption[] }>();

function withLabels(options: ShippingOption[]) {
  if (!options.length) return options;
  const cheapest = [...options].sort((a, b) => a.amount_cents - b.amount_cents)[0]?.id;
  const fastest = [...options].sort((a, b) => Number(a.estimated_days.split("-")[0]) - Number(b.estimated_days.split("-")[0]))[0]?.id;
  return options.map((option) => ({
    ...option,
    label: option.id === fastest ? "Fastest" : option.id === cheapest ? "Cheapest" : option.label ?? "Best value",
  }));
}

function toInternalOptions(subtotalCents: number, upsRates: Awaited<ReturnType<typeof getUpsRates>>): ShippingOption[] {
  const freeGround = subtotalCents >= 10_000;

  return upsRates.map((rate) => ({
    id: rate.id,
    name: rate.name,
    amount_cents: freeGround && rate.id === "ups_ground" ? 0 : rate.amount_cents,
    estimated_days: rate.estimated_days,
    provider: "UPS_REAL",
  }));
}

function mockFallback(subtotalCents: number) {
  return withLabels(buildMockShippingOptions(subtotalCents));
}

function keyFromInput(input: ShippingInput) {
  return `${input.destinationPostalCode}|${input.destinationState}|${input.weightGrams}|${input.subtotalCents}`;
}

export async function getShippingOptions(input: ShippingInput): Promise<{ options: ShippingOption[]; source: "UPS_REAL" | "UPS_MOCK" }> {
  const cacheKey = keyFromInput(input);
  const cacheHit = ratesCache.get(cacheKey);
  if (cacheHit && cacheHit.expiresAt > Date.now()) {
    return { options: cacheHit.options, source: env.UPS_CLIENT_ID ? "UPS_REAL" : "UPS_MOCK" };
  }

  try {
    const upsRates = await getUpsRates({
      destinationPostalCode: input.destinationPostalCode,
      destinationState: input.destinationState,
      destinationCountry: input.destinationCountry,
      weightGrams: input.weightGrams,
    });

    const internal = withLabels(toInternalOptions(input.subtotalCents, upsRates));
    ratesCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60 * 1000, options: internal });
    return { options: internal, source: "UPS_REAL" };
  } catch (error) {
    console.warn("[SHIPPING] Falling back to mock shipping rates", error);
    const fallback = mockFallback(input.subtotalCents);
    ratesCache.set(cacheKey, { expiresAt: Date.now() + 60 * 1000, options: fallback });
    return { options: fallback, source: "UPS_MOCK" };
  }
}
