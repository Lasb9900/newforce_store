export type ShippingOptionId = "ups_ground" | "ups_2day" | "ups_next_day";

export type ShippingOption = {
  id: ShippingOptionId;
  name: string;
  amount_cents: number;
  estimated_days: string;
  label?: "Best value" | "Fastest" | "Cheapest";
  provider: "UPS_REAL" | "UPS_MOCK";
};

export function buildShippingOptions(subtotalCents: number): ShippingOption[] {
  const ground = subtotalCents >= 10_000 ? 0 : 1_500;
  const secondDay = subtotalCents >= 10_000 ? 1_200 : 2_500;
  const nextDay = subtotalCents >= 10_000 ? 2_500 : 3_900;

  return [
    {
      id: "ups_ground",
      name: "UPS Ground",
      amount_cents: ground,
      estimated_days: "3-5 business days",
      label: ground === 0 ? "Cheapest" : "Best value",
      provider: "UPS_MOCK",
    },
    {
      id: "ups_2day",
      name: "UPS 2nd Day",
      amount_cents: secondDay,
      estimated_days: "2 business days",
      provider: "UPS_MOCK",
    },
    {
      id: "ups_next_day",
      name: "UPS Next Day",
      amount_cents: nextDay,
      estimated_days: "1 business day",
      label: "Fastest",
      provider: "UPS_MOCK",
    },
  ];
}

export function resolveShippingOption(options: ShippingOption[], selectedId: ShippingOptionId) {
  return options.find((option) => option.id === selectedId) ?? null;
}

export function calculateTaxCents() {
  return 0;
}
