import LegalPage from "@/components/legal/LegalPage";

export default function PrivacyPage() {
  const sections = [
    {
      id: "information-we-collect",
      title: "Information We Collect",
      content: (
        <>
          <p>
            We may collect personal information such as your name, email address,
            phone number, shipping address, and order details when you place an
            order or contact us.
          </p>
          <p>
            Payment information is processed securely by trusted third-party
            providers. We do not store full payment card details on our servers.
          </p>
        </>
      ),
    },
    {
      id: "how-we-use-information",
      title: "How We Use Your Information",
      content: (
        <>
          <p>Your information is used to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Process and fulfill your orders</li>
            <li>Send order confirmations and shipping updates</li>
            <li>Provide customer support</li>
            <li>Improve our website and customer experience</li>
          </ul>
        </>
      ),
    },
    {
      id: "sharing-information",
      title: "Sharing of Information",
      content: (
        <>
          <p>
            We do not sell your personal information. We may share data only
            when necessary with:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Payment processors</li>
            <li>Shipping carriers</li>
            <li>Service providers that support store operations</li>
            <li>Authorities when required by law</li>
          </ul>
        </>
      ),
    },
    {
      id: "data-protection",
      title: "Data Protection",
      content: (
        <>
          <p>
            We use reasonable administrative and technical safeguards to protect
            customer information.
          </p>
          <p>
            While no system can guarantee absolute security, we work with secure
            providers and platforms designed to help protect your data.
          </p>
        </>
      ),
    },
    {
      id: "cookies",
      title: "Cookies",
      content: (
        <>
          <p>
            Our website may use cookies and similar technologies to improve
            browsing, remember preferences, and support store functionality.
          </p>
        </>
      ),
    },
    {
      id: "your-rights",
      title: "Your Rights",
      content: (
        <>
          <p>
            You may request access, correction, or deletion of your personal
            data, subject to any legal or operational obligations we must keep.
          </p>
        </>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      content: (
        <>
          <p>
            If you have privacy-related questions, please contact us through the
            support channels available on our store.
          </p>
        </>
      ),
    },
  ];

  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="This page explains what information we collect, how we use it, and how we help protect your data when you shop with Liquidation Plus."
      sections={sections}
    />
  );
}