import Image from "next/image";
import Link from "next/link";
import { AdminSidebar } from "./admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2">
              <Image src="/brand/cta-isotipo.svg" alt="CTA Isotipo" width={28} height={28} className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Backoffice</p>
              <p className="font-semibold text-slate-900">Close to Amazon · Admin</p>
            </div>
          </div>
          <Link href="/" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
            Volver a tienda
          </Link>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-[250px_1fr]">
        <AdminSidebar />
        <section>{children}</section>
      </div>
    </div>
  );
}
