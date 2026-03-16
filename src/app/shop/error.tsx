"use client";

import Link from "next/link";

export default function ShopError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-900">
      <h2 className="text-2xl font-semibold">We couldn&apos;t load the storefront</h2>
      <p className="mt-2 text-sm">Try again in a few seconds or return to the home page.</p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button onClick={reset} className="btn-primary">
          Retry
        </button>
        <Link href="/" className="btn-secondary">
          Home
        </Link>
      </div>
    </div>
  );
}
