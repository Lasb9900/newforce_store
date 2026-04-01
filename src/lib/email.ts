import "server-only";

import { serverEnv } from "@/lib/server-env";
import { env } from "@/lib/env";
import { getServiceSupabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

const ORDER_CONFIRMATION_SENT_EVENT = "order_confirmation_email_sent";
const ORDER_CONFIRMATION_FAILED_EVENT = "order_confirmation_email_failed";

type OrderRecord = {
  id: string;
  created_at: string;
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  total_cents: number | null;
  subtotal_cents: number | null;
  shipping_cents: number | null;
  tax_cents: number | null;
  discount_cents: number | null;
  currency: string | null;
  points_redeemed: number | null;
  shipping_address_line_1: string | null;
  shipping_address_line_2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  shipping_address: {
    delivery_notes?: string | null;
  } | null;
  order_items: OrderItemRecord[] | null;
};

type OrderItemRecord = {
  name_snapshot: string | null;
  product_name_snapshot: string | null;
  qty: number | null;
  quantity: number | null;
  unit_price_cents_snapshot: number | null;
  unit_price_cents: number | null;
  line_total_cents: number | null;
  points_price_snapshot: number | null;
};

type ResendSendResponse = {
  id?: string;
  error?: {
    message?: string;
    name?: string;
  };
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatOrderDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatAddress(order: OrderRecord): string[] {
  const lines = [
    order.shipping_address_line_1,
    order.shipping_address_line_2,
    [order.shipping_city, order.shipping_state, order.shipping_postal_code]
      .filter(Boolean)
      .join(", "),
    order.shipping_country,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  const deliveryNotes = order.shipping_address?.delivery_notes?.trim();
  if (deliveryNotes) {
    lines.push(`Delivery notes: ${deliveryNotes}`);
  }

  return lines;
}

function getOrderEmailSubject(order: OrderRecord): string {
  const isPointsOrder = Number(order.points_redeemed ?? 0) > 0 || order.payment_method === "points";
  return isPointsOrder
    ? `Your Liquidation Plus redemption is confirmed (#${order.id.slice(0, 8).toUpperCase()})`
    : `Your Liquidation Plus order is confirmed (#${order.id.slice(0, 8).toUpperCase()})`;
}

function renderOrderItemsRows(order: OrderRecord): string {
  return (order.order_items ?? [])
    .map((item) => {
      const name = item.name_snapshot ?? item.product_name_snapshot ?? "Product";
      const qty = Number(item.quantity ?? item.qty ?? 0);
      const isPointsItem = Number(item.points_price_snapshot ?? 0) > 0 && Number(order.total_cents ?? 0) === 0;
      const lineTotalCents = Number(
        item.line_total_cents ??
          (item.unit_price_cents ?? item.unit_price_cents_snapshot ?? 0) * qty
      );
      const priceLabel = isPointsItem
        ? `${Number(item.points_price_snapshot ?? 0) * qty} pts`
        : formatCurrency(lineTotalCents, order.currency ?? "USD");

      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <div style="font-size:14px;font-weight:600;color:#0f172a;">${escapeHtml(name)}</div>
            <div style="font-size:12px;color:#64748b;">Quantity: ${qty}</div>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-size:14px;color:#0f172a;vertical-align:top;">
            ${escapeHtml(priceLabel)}
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderOrderSummaryRows(order: OrderRecord): string {
  const currency = order.currency ?? "USD";
  const subtotalCents = Number(order.subtotal_cents ?? 0);
  const shippingCents = Number(order.shipping_cents ?? 0);
  const taxCents = Number(order.tax_cents ?? 0);
  const discountCents = Number(order.discount_cents ?? 0);
  const totalCents = Number(order.total_cents ?? 0);
  const pointsRedeemed = Number(order.points_redeemed ?? 0);

  const rows = [
    `<tr><td style="padding:4px 0;color:#475569;font-size:14px;">Subtotal</td><td style="padding:4px 0;text-align:right;font-size:14px;color:#0f172a;">${escapeHtml(formatCurrency(subtotalCents, currency))}</td></tr>`,
    `<tr><td style="padding:4px 0;color:#475569;font-size:14px;">Shipping</td><td style="padding:4px 0;text-align:right;font-size:14px;color:#0f172a;">${escapeHtml(formatCurrency(shippingCents, currency))}</td></tr>`,
    `<tr><td style="padding:4px 0;color:#475569;font-size:14px;">Tax</td><td style="padding:4px 0;text-align:right;font-size:14px;color:#0f172a;">${escapeHtml(formatCurrency(taxCents, currency))}</td></tr>`,
  ];

  if (discountCents > 0) {
    rows.push(
      `<tr><td style="padding:4px 0;color:#475569;font-size:14px;">Discount</td><td style="padding:4px 0;text-align:right;font-size:14px;color:#0f172a;">-${escapeHtml(formatCurrency(discountCents, currency))}</td></tr>`
    );
  }

  if (pointsRedeemed > 0) {
    rows.push(
      `<tr><td style="padding:4px 0;color:#475569;font-size:14px;">Points used</td><td style="padding:4px 0;text-align:right;font-size:14px;color:#0f172a;">${pointsRedeemed} pts</td></tr>`
    );
  }

  rows.push(
  `<tr><td style="padding:14px 0 0;color:#111827;font-size:18px;font-weight:800;border-top:1px solid #e5e7eb;">Total</td><td style="padding:14px 0 0;text-align:right;font-size:18px;font-weight:800;color:#111827;border-top:1px solid #e5e7eb;">${pointsRedeemed > 0 && totalCents === 0 ? `${pointsRedeemed} pts` : escapeHtml(formatCurrency(totalCents, currency))}</td></tr>`
);

  return rows.join("");
}

function renderOrderConfirmationEmail(order: OrderRecord): { html: string; text: string } {
  const isPointsOrder = Number(order.points_redeemed ?? 0) > 0 || order.payment_method === "points";
  const orderLabel = order.id.slice(0, 8).toUpperCase();
  const addressLines = formatAddress(order);
  const orderUrl = `${env.NEXT_PUBLIC_SITE_URL}/account`;
  const addressHtml = addressLines.length
    ? addressLines.map((line) => `<div style="margin-bottom:4px;">${escapeHtml(line)}</div>`).join("")
    : "<div>Address will be confirmed separately.</div>";

  const paymentLabel = isPointsOrder ? "Points redemption" : "Secure card checkout";
  const intro = isPointsOrder
    ? "Your redemption was approved and your items are now reserved for shipping."
    : "Your payment was received successfully and your order is now being prepared.";

  const totalLabel =
    Number(order.points_redeemed ?? 0) > 0 && Number(order.total_cents ?? 0) === 0
      ? `${Number(order.points_redeemed ?? 0)} pts`
      : formatCurrency(Number(order.total_cents ?? 0), order.currency ?? "USD");

  const itemsHtml = (order.order_items ?? [])
    .map((item) => {
      const name = item.name_snapshot ?? item.product_name_snapshot ?? "Product";
      const qty = Number(item.quantity ?? item.qty ?? 0);
      const isPointsItem = Number(item.points_price_snapshot ?? 0) > 0 && Number(order.total_cents ?? 0) === 0;
      const lineTotalCents = Number(
        item.line_total_cents ??
          (item.unit_price_cents ?? item.unit_price_cents_snapshot ?? 0) * qty
      );

      const unitPriceCents = Number(item.unit_price_cents ?? item.unit_price_cents_snapshot ?? 0);

      const priceLabel = isPointsItem
        ? `${Number(item.points_price_snapshot ?? 0) * qty} pts`
        : formatCurrency(lineTotalCents, order.currency ?? "USD");

      const unitPriceLabel = isPointsItem
        ? `${Number(item.points_price_snapshot ?? 0)} pts each`
        : formatCurrency(unitPriceCents, order.currency ?? "USD");

      return `
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <div style="font-size:15px;font-weight:700;color:#111827;line-height:1.4;margin-bottom:6px;">
              ${escapeHtml(name)}
            </div>
            <div style="font-size:13px;color:#6b7280;line-height:1.6;">
              Quantity: ${qty}<br />
              Unit price: ${escapeHtml(unitPriceLabel)}
            </div>
          </td>
          <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:right;">
            <div style="font-size:15px;font-weight:700;color:#111827;">
              ${escapeHtml(priceLabel)}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div style="margin:0;padding:32px 16px;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(15,23,42,0.08);">

        <div style="background:#1f2f86;padding:24px 28px;color:#ffffff;">
          <div style="font-size:28px;font-weight:800;letter-spacing:-0.4px;">Liquidation Plus</div>
          <div style="font-size:13px;opacity:0.92;margin-top:6px;">Premium liquidation marketplace</div>
        </div>

        <div style="padding:30px 28px 12px 28px;">
          <div style="font-size:28px;font-weight:800;color:#111827;letter-spacing:-0.5px;margin-bottom:10px;">
            Your order is confirmed
          </div>
          <div style="font-size:15px;line-height:1.8;color:#374151;margin-bottom:22px;">
            Hi ${escapeHtml(order.buyer_name?.trim() || "there")},<br />
            ${escapeHtml(intro)}
          </div>

          <div style="background:#f8fafc;border:1px solid #dbe3ee;border-radius:16px;padding:18px 20px;margin-bottom:24px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="vertical-align:top;">
                  <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Order number</div>
                  <div style="font-size:22px;font-weight:800;color:#111827;">#${orderLabel}</div>
                  <div style="font-size:13px;color:#6b7280;margin-top:10px;">Placed on ${escapeHtml(formatOrderDate(order.created_at))}</div>
                </td>
                <td style="vertical-align:top;text-align:right;">
                  <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Order total</div>
                  <div style="font-size:24px;font-weight:800;color:#111827;">${escapeHtml(totalLabel)}</div>
                </td>
              </tr>
            </table>
          </div>

          <div style="text-align:center;margin:0 0 26px 0;">
            <a
              href="${escapeHtml(orderUrl)}"
              style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 24px;border-radius:10px;"
            >
              View your order
            </a>
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
            <tr>
              <td style="vertical-align:top;width:50%;padding-right:10px;">
                <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px 16px 14px 16px;height:100%;background:#ffffff;">
                  <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Shipping address</div>
                  <div style="font-size:14px;line-height:1.7;color:#111827;">
                    ${addressHtml}
                  </div>
                </div>
              </td>
              <td style="vertical-align:top;width:50%;padding-left:10px;">
                <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px 16px 14px 16px;height:100%;background:#ffffff;">
                  <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Payment & contact</div>
                  <div style="font-size:14px;line-height:1.7;color:#111827;">
                    <div style="margin-bottom:8px;"><strong>Payment:</strong> ${escapeHtml(paymentLabel)}</div>
                    <div style="margin-bottom:4px;"><strong>Email:</strong> ${escapeHtml(order.buyer_email ?? "—")}</div>
                    ${
                      order.buyer_phone
                        ? `<div><strong>Phone:</strong> ${escapeHtml(order.buyer_phone)}</div>`
                        : ""
                    }
                  </div>
                </div>
              </td>
            </tr>
          </table>

          <div style="border:1px solid #e5e7eb;border-radius:16px;padding:20px 20px 8px 20px;margin-bottom:24px;background:#ffffff;">
            <div style="font-size:18px;font-weight:800;color:#111827;margin-bottom:10px;">Items in this order</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              ${itemsHtml}
            </table>
          </div>

          <div style="border:1px solid #e5e7eb;border-radius:16px;padding:20px;background:#ffffff;margin-bottom:24px;">
            <div style="font-size:18px;font-weight:800;color:#111827;margin-bottom:14px;">Order summary</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              ${renderOrderSummaryRows(order)}
            </table>
          </div>

          <div style="background:#f8fafc;border:1px solid #dbe3ee;border-radius:16px;padding:18px 20px;margin-bottom:22px;">
            <div style="font-size:16px;font-weight:800;color:#111827;margin-bottom:8px;">What happens next?</div>
            <div style="font-size:14px;line-height:1.8;color:#4b5563;">
              We’ll send you another email as soon as your shipment is on the way.  
              You can also review your purchase details anytime from your account.
            </div>
          </div>

          <div style="text-align:center;margin-bottom:26px;">
            <a
              href="${escapeHtml(env.NEXT_PUBLIC_SITE_URL)}/shop"
              style="display:inline-block;color:#1f2f86;text-decoration:none;font-size:14px;font-weight:700;"
            >
              Continue shopping
            </a>
          </div>
        </div>

        <div style="padding:18px 28px 24px 28px;border-top:1px solid #e5e7eb;background:#ffffff;">
          <div style="font-size:12px;line-height:1.7;color:#6b7280;text-align:center;">
            Liquidation Plus · Premium liquidation marketplace<br />
            This is a transactional email regarding your recent purchase.
          </div>
        </div>
      </div>
    </div>
  `;

  const text = [
    "LIQUIDATION PLUS",
    "Premium liquidation marketplace",
    "",
    "YOUR ORDER IS CONFIRMED",
    "",
    `Hi ${order.buyer_name?.trim() || "there"},`,
    intro,
    "",
    `Order number: #${orderLabel}`,
    `Placed on: ${formatOrderDate(order.created_at)}`,
    `Order total: ${totalLabel}`,
    "",
    "Shipping address:",
    ...(addressLines.length ? addressLines : ["Address will be confirmed separately."]),
    "",
    `Payment: ${paymentLabel}`,
    `Email: ${order.buyer_email ?? "—"}`,
    ...(order.buyer_phone ? [`Phone: ${order.buyer_phone}`] : []),
    "",
    "Items:",
    ...(order.order_items ?? []).map((item) => {
      const name = item.name_snapshot ?? item.product_name_snapshot ?? "Product";
      const qty = Number(item.quantity ?? item.qty ?? 0);
      const isPointsItem = Number(item.points_price_snapshot ?? 0) > 0 && Number(order.total_cents ?? 0) === 0;
      const lineTotalCents = Number(
        item.line_total_cents ??
          (item.unit_price_cents ?? item.unit_price_cents_snapshot ?? 0) * qty
      );
      const priceLabel = isPointsItem
        ? `${Number(item.points_price_snapshot ?? 0) * qty} pts`
        : formatCurrency(lineTotalCents, order.currency ?? "USD");
      return `- ${name} x${qty} — ${priceLabel}`;
    }),
    "",
    `View your order: ${orderUrl}`,
    `Continue shopping: ${env.NEXT_PUBLIC_SITE_URL}/shop`,
    "",
    "We’ll send you another email as soon as your shipment is on the way.",
  ].join("\n");

  return { html, text };
}

async function getOrderForEmail(orderId: string): Promise<OrderRecord | null> {
  const admin = getServiceSupabase();
  const { data, error } = await admin
    .from("orders")
    .select(`
      id,
      created_at,
      status,
      payment_status,
      payment_method,
      buyer_email,
      buyer_name,
      buyer_phone,
      total_cents,
      subtotal_cents,
      shipping_cents,
      tax_cents,
      discount_cents,
      currency,
      points_redeemed,
      shipping_address_line_1,
      shipping_address_line_2,
      shipping_city,
      shipping_state,
      shipping_postal_code,
      shipping_country,
      shipping_address,
      order_items(
        name_snapshot,
        product_name_snapshot,
        qty,
        quantity,
        unit_price_cents_snapshot,
        unit_price_cents,
        line_total_cents,
        points_price_snapshot
      )
    `)
    .eq("id", orderId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OrderRecord | null;
}

async function hasConfirmationEmailBeenSent(orderId: string): Promise<boolean> {
  const admin = getServiceSupabase();
  const { data, error } = await admin
    .from("order_events")
    .select("id")
    .eq("order_id", orderId)
    .eq("event_type", ORDER_CONFIRMATION_SENT_EVENT)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.id);
}

async function logOrderEmailEvent(
  orderId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const admin = getServiceSupabase();
  const { error } = await admin.from("order_events").insert({
    order_id: orderId,
    event_type: eventType,
    payload,
  });

  if (error) {
    console.error("[EMAIL][ORDER_EVENT_ERROR]", { orderId, eventType, error });
  }
}

export async function sendOrderConfirmationEmailIfNeeded(orderId: string) {
  console.log("[EMAIL][START]", { orderId });

  if (!serverEnv.RESEND_API_KEY || !serverEnv.EMAIL_FROM_ADDRESS) {
    console.warn("[EMAIL][SKIPPED_NOT_CONFIGURED]", {
      hasApiKey: Boolean(serverEnv.RESEND_API_KEY),
      hasFromAddress: Boolean(serverEnv.EMAIL_FROM_ADDRESS),
      orderId,
    });
    return { sent: false, reason: "not_configured" as const };
  }

  if (await hasConfirmationEmailBeenSent(orderId)) {
    console.warn("[EMAIL][SKIPPED_ALREADY_SENT]", { orderId });
    return { sent: false, reason: "already_sent" as const };
  }

  const order = await getOrderForEmail(orderId);
  console.log("[EMAIL][ORDER_FETCHED]", {
    orderId,
    found: Boolean(order),
    status: order?.status,
    payment_status: order?.payment_status,
    buyer_email: order?.buyer_email,
  });

  if (!order) {
    console.warn("[EMAIL][SKIPPED_ORDER_NOT_FOUND]", { orderId });
    return { sent: false, reason: "order_not_found" as const };
  }

  if (order.status !== "paid" || order.payment_status !== "paid") {
    console.warn("[EMAIL][SKIPPED_ORDER_NOT_PAID]", {
      orderId,
      status: order.status,
      payment_status: order.payment_status,
    });
    return { sent: false, reason: "order_not_paid" as const };
  }

  if (!order.buyer_email) {
    console.warn("[EMAIL][SKIPPED_MISSING_EMAIL]", { orderId });
    return { sent: false, reason: "missing_email" as const };
  }

  const { html, text } = renderOrderConfirmationEmail(order);

  console.log("[EMAIL][SENDING]", {
    orderId,
    from: serverEnv.EMAIL_FROM_ADDRESS,
    to: order.buyer_email,
    replyTo: serverEnv.EMAIL_REPLY_TO || null,
    subject: getOrderEmailSubject(order),
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: serverEnv.EMAIL_FROM_ADDRESS,
      to: [order.buyer_email],
      reply_to: serverEnv.EMAIL_REPLY_TO || undefined,
      subject: getOrderEmailSubject(order),
      html,
      text,
    }),
  });

  const payload = (await response.json().catch(() => null)) as ResendSendResponse | null;

  console.log("[EMAIL][RESEND_RESPONSE]", {
    orderId,
    ok: response.ok,
    status: response.status,
    payload,
  });

  if (!response.ok) {
    await logOrderEmailEvent(orderId, ORDER_CONFIRMATION_FAILED_EVENT, {
      provider: "resend",
      status: response.status,
      response: payload,
      to: order.buyer_email,
    });

    throw new Error(payload?.error?.message || `Resend send failed with status ${response.status}`);
  }

  await logOrderEmailEvent(orderId, ORDER_CONFIRMATION_SENT_EVENT, {
    provider: "resend",
    resend_email_id: payload?.id ?? null,
    to: order.buyer_email,
    payment_method: order.payment_method,
  });

  console.log("[EMAIL][SENT_OK]", {
    orderId,
    resendEmailId: payload?.id ?? null,
  });

  return {
    sent: true,
    reason: "sent" as const,
    resendEmailId: payload?.id ?? null,
  };
}