"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: <span aria-hidden>◫</span>,
  },
  {
    href: "/admin/products",
    label: "Productos",
    icon: <span aria-hidden>◩</span>,
  },
  {
    href: "/admin/orders",
    label: "Órdenes",
    icon: <span aria-hidden>◬</span>,
  },
  {
    href: "/admin/reviews",
    label: "Reviews",
    icon: <span aria-hidden>★</span>,
  },
  {
    href: "/pos",
    label: "POS / Tienda física",
    icon: <span aria-hidden>◧</span>,
  },
  {
    href: "/admin/pos/sales",
    label: "POS · Ventas",
    icon: <span aria-hidden>▤</span>,
  },
  {
    href: "/admin/pos/closure",
    label: "POS · Cierre de caja",
    icon: <span aria-hidden>◍</span>,
  },
  {
    href: "/admin/pos/closures",
    label: "POS · Historial cierres",
    icon: <span aria-hidden>◌</span>,
  },
  {
    href: "/account",
    label: "Cuenta cliente",
    icon: <span aria-hidden>◉</span>,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Panel admin</p>
      <nav className="space-y-1.5 text-sm">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition",
                isActive
                  ? "bg-brand-secondary text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <span className={clsx("text-sm", isActive ? "text-white" : "text-slate-500")}>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
