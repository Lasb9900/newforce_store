"use client";

import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function SignOutButton() {
  return (
    <button
      className="rounded px-3 py-1.5 hover:bg-white/10"
      onClick={async () => {
        const supabase = getBrowserSupabase();
        await supabase.auth.signOut();
        location.href = "/";
      }}
    >
      Logout
    </button>
  );
}
