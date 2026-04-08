import Link from "next/link";

type LegalSection = {
  id: string;
  title: string;
  content: React.ReactNode;
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: LegalSection[];
};

export default function LegalPage({
  eyebrow,
  title,
  description,
  sections,
}: LegalPageProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              {eyebrow}
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              {title}
            </h1>

            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Legal
              </h2>
            </div>

            <nav className="flex flex-col p-2">
              <Link
                href="/privacy"
                className="rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Terms & Conditions
              </Link>
              <Link
                href="/policies"
                className="rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Store Policies
              </Link>
            </nav>
          </div>
        </aside>

        <main>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-5 sm:px-8">
              <p className="text-sm text-slate-500">
                Last updated: April 2026
              </p>
            </div>

            <div className="px-6 py-8 sm:px-8">
              <div className="space-y-10">
                {sections.map((section, index) => (
                  <section
                    key={section.id}
                    id={section.id}
                    className={index !== sections.length - 1 ? "border-b border-slate-100 pb-10" : ""}
                  >
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                      {section.title}
                    </h2>
                    <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-600">
                      {section.content}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}