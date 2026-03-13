"use client";

import { create } from "zustand";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type AuthState = {
  initialized: boolean;
  initializing: boolean;
  userId: string | null;
  authSource: "unknown" | "server_cookie" | "supabase_listener";
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
};

let subscriptionBound = false;

async function fetchSessionFromServer() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) throw new Error("Session check failed");
  return (await response.json()) as { authenticated: boolean; userId: string | null };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  initialized: false,
  initializing: false,
  userId: null,
  authSource: "unknown",

  refresh: async () => {
    try {
      const result = await fetchSessionFromServer();
      console.info("[AUTH_DEBUG] refresh", { authenticated: result.authenticated, userId: result.userId, render: "client" });
      set({ userId: result.userId ?? null, authSource: "server_cookie", initialized: true, initializing: false });
    } catch (error) {
      console.warn("[AUTH_DEBUG] refresh failed", { error: error instanceof Error ? error.message : "unknown" });
      set({ initialized: true, initializing: false });
    }
  },

  initialize: async () => {
    if (get().initialized || get().initializing) return;

    set({ initializing: true });
    await get().refresh();

    if (!subscriptionBound) {
      const supabase = getBrowserSupabase();
      supabase.auth.onAuthStateChange((_event, session) => {
        console.info("[AUTH_DEBUG] onAuthStateChange", { event: _event, userId: session?.user?.id ?? null, render: "client" });
        set({ userId: session?.user?.id ?? null, authSource: "supabase_listener", initialized: true, initializing: false });
        void get().refresh();
      });
      subscriptionBound = true;
    }
  },
}));
