import LegalPage from "@/components/legal/LegalPage";

export default function TermsPage() {
  const sections = [
    {
      id: "general-information",
      title: "General Information",
      content: (
        <>
          <p>
            This website is operated by <strong>Liquidation Plus</strong>. By
            accessing our store and placing an order, you agree to these Terms &
            Conditions.
          </p>
        </>
      ),
    },
    {
      id: "product-condition",
      title: "Product Condition",
      content: (
        <>
          <p>
            Products sold on our store may be listed as New, Open Box, or Used.
          </p>
          <p>
            Some items may show minor cosmetic imperfections and may not include
            original packaging or non-essential accessories. Products are tested
            before shipping unless otherwise stated.
          </p>
        </>
      ),
    },
    {
      id: "orders-payments",
      title: "Orders & Payments",
      content: (
        <>
          <p>
            Orders are processed only after successful payment confirmation. We
            reserve the right to refuse or cancel any order if necessary.
          </p>
        </>
      ),
    },
    {
      id: "processing-shipping",
      title: "Processing & Shipping",
      content: (
        <>
          <p>
            Orders are typically processed within 1–2 business days. Delivery
            times may vary depending on destination, carrier, and operational
            factors.
          </p>
        </>
      ),
    },
    {
      id: "cancellations",
      title: "Cancellations",
      content: (
        <>
          <p>
            Orders cannot be canceled once they have been processed.
          </p>
        </>
      ),
    },
    {
      id: "final-sale",
      title: "Final Sale Policy",
      content: (
        <>
          <p>
            All sales are final. We do not accept returns, refunds, or
            exchanges, except where required by applicable law.
          </p>
        </>
      ),
    },
    {
      id: "limited-guarantee",
      title: "Limited Functional Guarantee",
      content: (
        <>
          <p>
            Products are guaranteed to be functional as described. Any issue
            must be reported within 48 hours of delivery with supporting
            evidence.
          </p>
        </>
      ),
    },
    {
      id: "liability",
      title: "Limitation of Liability",
      content: (
        <>
          <p>
            Our liability is limited strictly to the amount paid for the
            purchased product.
          </p>
        </>
      ),
    },
    {
      id: "acceptance",
      title: "Acceptance",
      content: (
        <>
          <p>
            By placing an order, you confirm that you have read, understood, and
            accepted these Terms & Conditions.
          </p>
        </>
      ),
    },
  ];

  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms & Conditions"
      description="These terms explain the rules, responsibilities, and purchase conditions that apply when you buy from Liquidation Plus."
      sections={sections}
    />
  );
}