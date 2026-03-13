"use client";

import { create } from "zustand";
import { useAuthStore } from "@/lib/auth-store";

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

const GUEST_WISHLIST_KEY = "wishlist:guest";
let authSubscriptionBound = false;
let wishlistQueue = Promise.resolve();

function enqueue(task: () => Promise<void>) {
  wishlistQueue = wishlistQueue.then(task, task);
  return wishlistQueue;
}

function readGuestWishlist() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistGuestWishlist(productIds: string[]) {
  if (typeof window === "undefined") return;
  if (!productIds.length) {
    localStorage.removeItem(GUEST_WISHLIST_KEY);
    return;
  }
  localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(Array.from(new Set(productIds))));
}

function guestItemsFromIds(ids: string[]): WishlistItem[] {
  return ids.map((productId) => ({ id: `guest:${productId}`, product_id: productId, products: null }));
}

async function fetchWishlist() {
  const response = await fetch("/api/me/wishlist", { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load wishlist");
  const json = (await response.json()) as { data?: WishlistItem[] };
  return json.data ?? [];
}

async function addToServerWishlist(productId: string) {
  const response = await fetch(`/api/me/wishlist/${productId}`, { method: "POST" });
  if (!response.ok) throw new Error("Failed to add wishlist item");
}

async function removeFromServerWishlist(productId: string) {
  const response = await fetch(`/api/me/wishlist/${productId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to remove wishlist item");
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
      set({ currentUserId: userId, syncing: true, items: [] });
      try {
        if (!userId) {
          const guestIds = readGuestWishlist();
          set({ items: guestItemsFromIds(guestIds), notice: null });
          return;
        }

        let items = await fetchWishlist();
        const guestIds = readGuestWishlist();

        if (guestIds.length > 0) {
          const existing = new Set(items.map((item) => item.product_id));
          for (const productId of guestIds) {
            if (existing.has(productId)) continue;
            await addToServerWishlist(productId);
          }
          localStorage.removeItem(GUEST_WISHLIST_KEY);
          items = await fetchWishlist();
          set({ notice: { type: "info", message: "Guest wishlist merged into your account." } });
        } else {
          set({ notice: null });
        }

        set({ items });
      } catch {
        const fallback = userId ? [] : guestItemsFromIds(readGuestWishlist());
        set({ items: fallback, notice: { type: "warning", message: "Could not sync your wishlist." } });
      } finally {
        set({ syncing: false });
      }
    };

    const auth = useAuthStore.getState();
    await auth.initialize();
    await applyForUser(useAuthStore.getState().userId);

    if (!authSubscriptionBound) {
      useAuthStore.subscribe((state, prev) => {
        if (state.userId === prev.userId) return;
        void applyForUser(state.userId);
      });
      authSubscriptionBound = true;
    }

    set({ initialized: true, initializing: false, syncing: false });
  },

  toggle: async (productId: string) =>
    enqueue(async () => {
      const { currentUserId } = get();
      set({ syncing: true });
      try {
        const inWishlist = get().items.some((item) => item.product_id === productId);

        if (!currentUserId) {
          const ids = new Set(readGuestWishlist());
          if (inWishlist) ids.delete(productId);
          else ids.add(productId);
          persistGuestWishlist(Array.from(ids));
          set({ items: guestItemsFromIds(Array.from(ids)), notice: null });
          return;
        }

        if (inWishlist) await removeFromServerWishlist(productId);
        else await addToServerWishlist(productId);

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
