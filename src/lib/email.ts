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
  const orderLabel = order.id.slice(0, 8).toUpperCase();
  const orderUrl = `${env.NEXT_PUBLIC_SITE_URL}/account`;
  const shopUrl = `${env.NEXT_PUBLIC_SITE_URL}/shop`;

  const addressLines = formatAddress(order);
  const addressHtml = addressLines.length
    ? addressLines.map((l) => `<div>${escapeHtml(l)}</div>`).join("")
    : "<div>Address will be confirmed separately.</div>";

  const total = formatCurrency(Number(order.total_cents ?? 0), order.currency ?? "USD");

  const itemsHtml = (order.order_items ?? [])
    .map((item) => {
      const name = item.name_snapshot ?? "Product";
      const qty = Number(item.quantity ?? item.qty ?? 0);
      const price = formatCurrency(
        Number(item.line_total_cents ?? item.unit_price_cents ?? 0),
        order.currency ?? "USD"
      );

      return `
        <tr>
          <td style="padding:12px 0;">
            <div style="font-weight:600;">${escapeHtml(name)}</div>
            <div style="font-size:13px;color:#6b7280;">Qty: ${qty}</div>
          </td>
          <td style="text-align:right;font-weight:600;">${price}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
  <div style="margin:0;padding:30px;background:#f3f4f6;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

      <!-- HEADER -->
      <div style="background:#1e3a8a;color:#fff;padding:20px;">
        <h2 style="margin:0;">Liquidation Plus</h2>
        <div style="font-size:13px;">Premium liquidation marketplace</div>
      </div>

      <!-- CONTENT -->
      <div style="padding:24px;">

        <h2 style="margin-top:0;">🎉 Your order is confirmed</h2>

        <p style="color:#374151;">
          Hi ${escapeHtml(order.buyer_name || "there")},<br/>
          Your payment was successful and your order is now being prepared.
        </p>

        <!-- ORDER BOX -->
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:20px 0;">
          <strong>Order #${orderLabel}</strong><br/>
          <span style="font-size:13px;color:#6b7280;">
            ${formatOrderDate(order.created_at)}
          </span>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin:25px 0;">
          <a href="${orderUrl}" style="background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;">
            View your order
          </a>
        </div>

        <!-- ADDRESS + PAYMENT -->
        <table width="100%" style="margin-bottom:20px;">
          <tr>
            <td style="width:50%;vertical-align:top;">
              <strong>Shipping</strong>
              <div style="font-size:14px;color:#374151;">${addressHtml}</div>
            </td>
            <td style="width:50%;vertical-align:top;">
              <strong>Payment</strong>
              <div style="font-size:14px;color:#374151;">
                Secure card checkout<br/>
                ${escapeHtml(order.buyer_email || "")}
              </div>
            </td>
          </tr>
        </table>

        <!-- ITEMS -->
        <h3>Items</h3>
        <table width="100%" style="border-top:1px solid #e5e7eb;">
          ${itemsHtml}
        </table>

        <!-- SUMMARY -->
        <div style="margin-top:20px;padding:16px;border:1px solid #e5e7eb;border-radius:10px;">
          <table width="100%">
            <tr><td>Subtotal</td><td style="text-align:right;">${total}</td></tr>
            <tr><td>Shipping</td><td style="text-align:right;">$0.00</td></tr>
            <tr><td>Tax</td><td style="text-align:right;">$0.00</td></tr>
            <tr>
              <td style="font-weight:700;padding-top:10px;">Total</td>
              <td style="text-align:right;font-weight:700;padding-top:10px;">${total}</td>
            </tr>
          </table>
        </div>

        <!-- NEXT STEP -->
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-top:20px;">
          <strong>What happens next?</strong><br/>
          We’ll notify you when your order ships.
        </div>

        <!-- RETENTION -->
        <div style="text-align:center;margin-top:20px;">
          <a href="${shopUrl}" style="color:#1e3a8a;text-decoration:none;font-weight:600;">
            Continue shopping →
          </a>
        </div>

      </div>

      <!-- FOOTER -->
      <div style="padding:20px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
        Liquidation Plus · Premium liquidation marketplace
      </div>

    </div>
  </div>
  `;

  const text = `
LIQUIDATION PLUS

Your order is confirmed

Hi ${order.buyer_name || "there"},
Your order has been successfully paid.

Order: #${orderLabel}
Total: ${total}

View your order:
${orderUrl}

Continue shopping:
${shopUrl}
`;

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