import LegalPage from "@/components/legal/LegalPage";

export default function PoliciesPage() {
  const sections = [
    {
      id: "shipping-policy",
      title: "Shipping Policy",
      content: (
        <>
          <p>
            Orders are generally processed within 1–2 business days. Delivery
            timelines depend on the destination and shipping carrier.
          </p>
          <p>
            Tracking information will be provided when available.
          </p>
        </>
      ),
    },
    {
      id: "product-condition-policy",
      title: "Product Condition Policy",
      content: (
        <>
          <p>
            Products may be sold as New, Open Box, or Used.
          </p>
          <p>
            Some items may have minor cosmetic signs of handling or may not
            include original packaging and non-essential accessories.
          </p>
        </>
      ),
    },
    {
      id: "final-sale-policy",
      title: "No Return / Final Sale Policy",
      content: (
        <>
          <p>
            All sales are final. We do not accept returns, refunds, or
            exchanges.
          </p>
        </>
      ),
    },
    {
      id: "guarantee-policy",
      title: "Guarantee Policy",
      content: (
        <>
          <p>
            Products are guaranteed functional as described. Any issue must be
            reported within 48 hours of delivery with valid proof.
          </p>
        </>
      ),
    },
    {
      id: "payment-policy",
      title: "Payment Policy",
      content: (
        <>
          <p>
            Payments are processed securely through trusted payment providers
            such as Stripe.
          </p>
        </>
      ),
    },
    {
      id: "cancellation-policy",
      title: "Cancellation Policy",
      content: (
        <>
          <p>
            Orders cannot be canceled once processing has started.
          </p>
        </>
      ),
    },
  ];

  return (
    <LegalPage
      eyebrow="Store Information"
      title="Store Policies"
      description="These policies summarize the key operational rules for shipping, payments, product condition, final sale terms, and support expectations."
      sections={sections}
    />
  );
}