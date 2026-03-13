"use client";

import { create } from "zustand";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type AuthState = {
  initialized: boolean;
  initializing: boolean;
  userId: string | null;
  initialize: () => Promise<void>;
};

let subscriptionBound = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  initialized: false,
  initializing: false,
  userId: null,

  initialize: async () => {
    if (get().initialized || get().initializing) return;

    set({ initializing: true });
    const supabase = getBrowserSupabase();

    try {
      const { data } = await supabase.auth.getUser();
      set({ userId: data.user?.id ?? null });
    } finally {
      set({ initialized: true, initializing: false });
    }

    if (!subscriptionBound) {
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ userId: session?.user?.id ?? null, initialized: true, initializing: false });
      });
      subscriptionBound = true;
    }
  },
}));
