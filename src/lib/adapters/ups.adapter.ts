import { env } from "@/lib/env";

type UpsRateInput = {
  destinationPostalCode: string;
  destinationState: string;
  destinationCountry: "US";
  weightGrams: number;
};

export type UpsRate = {
  id: "ups_ground" | "ups_2day" | "ups_next_day";
  name: string;
  amount_cents: number;
  estimated_days: string;
};

let tokenCache: { token: string; expiresAt: number } | null = null;

function getUpsBaseUrl() {
  return env.UPS_ENVIRONMENT === "production"
    ? "https://onlinetools.ups.com"
    : "https://wwwcie.ups.com";
}

async function getUpsToken() {
  if (!env.UPS_CLIENT_ID || !env.UPS_CLIENT_SECRET) {
    throw new Error("UPS credentials are not configured");
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 15_000) {
    return tokenCache.token;
  }

  const tokenRes = await fetch(`${getUpsBaseUrl()}/security/v1/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.UPS_CLIENT_ID}:${env.UPS_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    throw new Error(`UPS OAuth failed with ${tokenRes.status}`);
  }

  const tokenJson = await tokenRes.json() as { access_token?: string; expires_in?: number };
  if (!tokenJson.access_token) {
    throw new Error("UPS OAuth returned no access token");
  }

  const expiresInMs = Number(tokenJson.expires_in ?? 300) * 1000;
  tokenCache = { token: tokenJson.access_token, expiresAt: Date.now() + expiresInMs };
  return tokenJson.access_token;
}

function convertUpsServiceToInternal(serviceCode: string, amountCents: number): UpsRate | null {
  if (serviceCode === "03") {
    return { id: "ups_ground", name: "UPS Ground", amount_cents: amountCents, estimated_days: "3-5 business days" };
  }
  if (serviceCode === "02") {
    return { id: "ups_2day", name: "UPS 2nd Day", amount_cents: amountCents, estimated_days: "2 business days" };
  }
  if (serviceCode === "01") {
    return { id: "ups_next_day", name: "UPS Next Day", amount_cents: amountCents, estimated_days: "1 business day" };
  }

  return null;
}

export async function getUpsRates(input: UpsRateInput): Promise<UpsRate[]> {
  if (!env.UPS_ACCOUNT_NUMBER || !env.UPS_SHIPPER_ZIP) {
    throw new Error("UPS account configuration is incomplete");
  }

  const token = await getUpsToken();
  const payload = {
    RateRequest: {
      Request: {
        TransactionReference: { CustomerContext: "checkout-rate" },
      },
      Shipment: {
        Shipper: {
          ShipperNumber: env.UPS_ACCOUNT_NUMBER,
          Address: {
            PostalCode: env.UPS_SHIPPER_ZIP,
            CountryCode: env.UPS_SHIPPER_COUNTRY,
          },
        },
        ShipTo: {
          Address: {
            PostalCode: input.destinationPostalCode,
            StateProvinceCode: input.destinationState,
            CountryCode: input.destinationCountry,
            ResidentialAddressIndicator: "",
          },
        },
        Package: {
          PackagingType: { Code: "02" },
          PackageWeight: {
            UnitOfMeasurement: { Code: "LBS" },
            Weight: (Math.max(1, input.weightGrams) / 453.592).toFixed(2),
          },
        },
      },
    },
  };

  const response = await fetch(`${getUpsBaseUrl()}/api/rating/v1/Rate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`UPS rating failed with ${response.status}`);
  }

  const json = await response.json() as {
    RateResponse?: {
      RatedShipment?: Array<{
        Service?: { Code?: string };
        TotalCharges?: { MonetaryValue?: string };
      }>;
    };
  };

  const shipments = json.RateResponse?.RatedShipment ?? [];
  const mapped = shipments
    .map((shipment) => {
      const serviceCode = shipment.Service?.Code ?? "";
      const amount = Number(shipment.TotalCharges?.MonetaryValue ?? 0);
      const amountCents = Math.round(amount * 100);
      return convertUpsServiceToInternal(serviceCode, amountCents);
    })
    .filter((rate): rate is UpsRate => Boolean(rate));

  if (!mapped.length) {
    throw new Error("UPS rating returned no mappable services");
  }

  return mapped;
}
