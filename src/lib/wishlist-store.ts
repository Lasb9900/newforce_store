"use client";

import { create } from "zustand";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type WishlistNotice = { type: "info" | "warning"; message: string };

type WishlistProduct = {
  id: string;
  name?: string | null;
  image_url?: string | null;
  base_price_cents?: number | null;
};

type WishlistItem = {
  id: string;
  product_id: string;
  products?: WishlistProduct | null;
};

type WishlistState = {
  items: WishlistItem[];
  initialized: boolean;
  initializing: boolean;
  syncing: boolean;
  currentUserId: string | null;
  notice: WishlistNotice | null;
  initialize: () => Promise<void>;
  toggle: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  dismissNotice: () => void;
};

let authSubscriptionBound = false;
let wishlistQueue = Promise.resolve();

function enqueue(task: () => Promise<void>) {
  wishlistQueue = wishlistQueue.then(task, task);
  return wishlistQueue;
}

async function getCurrentUserId() {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function fetchWishlist() {
  const response = await fetch("/api/me/wishlist", { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load wishlist");
  const json = (await response.json()) as { data?: WishlistItem[] };
  return json.data ?? [];
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  initialized: false,
  initializing: false,
  syncing: false,
  currentUserId: null,
  notice: null,

  initialize: async () => {
    if (get().initialized || get().initializing) return;

    set({ initializing: true, syncing: true });

    const applyForUser = async (userId: string | null) => {
      try {
        if (!userId) {
          set({ currentUserId: null, items: [], notice: { type: "info", message: "Log in to save products to your wishlist." } });
          return;
        }

        const items = await fetchWishlist();
        set({ currentUserId: userId, items, notice: null });
      } catch {
        set({ currentUserId: userId, items: [], notice: { type: "warning", message: "Could not sync your wishlist." } });
      } finally {
        set({ syncing: false });
      }
    };

    const userId = await getCurrentUserId();
    await applyForUser(userId);

    if (!authSubscriptionBound) {
      const supabase = getBrowserSupabase();
      supabase.auth.onAuthStateChange(async (_event, session) => {
        const nextUserId = session?.user?.id ?? null;
        if (nextUserId === get().currentUserId) return;
        set({ syncing: true });
        await applyForUser(nextUserId);
      });
      authSubscriptionBound = true;
    }

    set({ initialized: true, initializing: false, syncing: false });
  },

  toggle: async (productId: string) =>
    enqueue(async () => {
      const { currentUserId } = get();
      if (!currentUserId) {
        set({ notice: { type: "info", message: "Please log in to use wishlist." } });
        return;
      }

      set({ syncing: true });
      try {
        const inWishlist = get().items.some((item) => item.product_id === productId);
        const method = inWishlist ? "DELETE" : "POST";
        const response = await fetch(`/api/me/wishlist/${productId}`, { method });
        if (!response.ok) throw new Error("Wishlist update failed");

        const items = await fetchWishlist();
        set({ items, notice: null });
      } catch {
        set({ notice: { type: "warning", message: "Unable to update wishlist. Try again." } });
      } finally {
        set({ syncing: false });
      }
    }),

  isInWishlist: (productId: string) => get().items.some((item) => item.product_id === productId),

  dismissNotice: () => set({ notice: null }),
}));
