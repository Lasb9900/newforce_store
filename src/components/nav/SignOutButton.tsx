"use client";

import clsx from "clsx";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type Props = {
  className?: string;
  children?: React.ReactNode;
  redirectTo?: string;
};

export default function SignOutButton({ className, children, redirectTo = "/login" }: Props) {
  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // keep fallback below
    }

    // Fallback cleanup on browser side as well.
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    location.href = redirectTo;
  }

  return (
    <button className={clsx("rounded px-3 py-1.5", className)} onClick={logout}>
      {children ?? "Logout"}
    </button>
  );
}
