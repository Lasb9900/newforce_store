"use client";

import clsx from "clsx";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type Props = {
  className?: string;
  children?: React.ReactNode;
};

export default function SignOutButton({ className, children }: Props) {
  return (
    <button
      className={clsx("rounded px-3 py-1.5", className)}
      onClick={async () => {
        const supabase = getBrowserSupabase();
        await supabase.auth.signOut();
        location.href = "/";
      }}
    >
      {children ?? "Logout"}
    </button>
  );
}
