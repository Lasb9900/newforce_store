"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export function AuthDebugPanel() {
  const pathname = usePathname();
  const initialize = useAuthStore((state) => state.initialize);
  const refresh = useAuthStore((state) => state.refresh);
  const initialized = useAuthStore((state) => state.initialized);
  const initializing = useAuthStore((state) => state.initializing);
  const userId = useAuthStore((state) => state.userId);
  const authSource = useAuthStore((state) => state.authSource);

  useEffect(() => {
    void initialize();
    void refresh();
  }, [initialize, refresh, pathname]);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="fixed bottom-3 right-3 z-[9999] max-w-sm rounded-lg border border-slate-300 bg-white/95 p-3 text-[11px] shadow-lg">
      <p className="font-semibold">AUTH DEBUG PANEL</p>
      <p>[route] {pathname}</p>
      <p>[hydrated] {String(initialized)}</p>
      <p>[initializing] {String(initializing)}</p>
      <p>[status] {userId ? "authenticated" : "guest"}</p>
      <p>[userId] {userId ?? "null"}</p>
      <p>[source] {authSource}</p>
    </div>
  );
}
