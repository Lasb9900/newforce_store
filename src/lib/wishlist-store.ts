"use client";

import { create } from "zustand";
import { useAuthStore } from "@/lib/auth-store";

type WishlistNotice = { type: "info" | "warning"; message: string };

type WishlistProduct = {
  id: string;
  name?: string | null;
  slug?: string | null;
  image_url?: string | null;
  base_price_cents?: number | null;
};

type WishlistItem = {
  id: string;
  product_id: string;
  products?: WishlistProduct | null;
};

type GuestWishlistStoredItem = {
  product_id: string;
  products: WishlistProduct | null;
};

type WishlistToggleInput =
  | string
  | {
      id: string;
      name?: string | null;
      slug?: string | null;
      image_url?: string | null;
      base_price_cents?: number | null;
    };

type WishlistState = {
  items: WishlistItem[];
  initialized: boolean;
  initializing: boolean;
  syncing: boolean;
  currentUserId: string | null;
  notice: WishlistNotice | null;
  initialize: () => Promise<void>;
  toggle: (input: WishlistToggleInput) => Promise<void>;
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

function dedupeGuestWishlist(items: GuestWishlistStoredItem[]): GuestWishlistStoredItem[] {
  const map = new Map<string, GuestWishlistStoredItem>();

  for (const item of items) {
    if (!item?.product_id) continue;

    const previous = map.get(item.product_id);

    if (!previous) {
      map.set(item.product_id, item);
      continue;
    }

    map.set(item.product_id, {
      product_id: item.product_id,
      products: item.products ?? previous.products ?? null,
    });
  }

  return Array.from(map.values());
}

function normalizeGuestWishlistItem(value: unknown): GuestWishlistStoredItem | null {
  if (typeof value === "string") {
    return {
      product_id: value,
      products: null,
    };
  }

  if (!value || typeof value !== "object") return null;

  const item = value as {
    product_id?: unknown;
    products?: {
      id?: unknown;
      name?: unknown;
      slug?: unknown;
      image_url?: unknown;
      base_price_cents?: unknown;
    } | null;
  };

  if (typeof item.product_id !== "string" || !item.product_id) return null;

  const rawProduct = item.products;
  const product: WishlistProduct | null =
    rawProduct && typeof rawProduct === "object"
      ? {
          id: typeof rawProduct.id === "string" && rawProduct.id ? rawProduct.id : item.product_id,
          name: typeof rawProduct.name === "string" ? rawProduct.name : null,
          slug: typeof rawProduct.slug === "string" ? rawProduct.slug : null,
          image_url: typeof rawProduct.image_url === "string" ? rawProduct.image_url : null,
          base_price_cents:
            typeof rawProduct.base_price_cents === "number" ? rawProduct.base_price_cents : null,
        }
      : null;

  return {
    product_id: item.product_id,
    products: product,
  };
}

function readGuestWishlist(): GuestWishlistStoredItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return dedupeGuestWishlist(
      parsed
        .map((item) => normalizeGuestWishlistItem(item))
        .filter((item): item is GuestWishlistStoredItem => Boolean(item)),
    );
  } catch {
    return [];
  }
}

function persistGuestWishlist(items: GuestWishlistStoredItem[]) {
  if (typeof window === "undefined") return;

  const normalized = dedupeGuestWishlist(items);

  if (!normalized.length) {
    localStorage.removeItem(GUEST_WISHLIST_KEY);
    return;
  }

  localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(normalized));
}

function guestItemsFromStorage(items: GuestWishlistStoredItem[]): WishlistItem[] {
  return items.map((item) => ({
    id: `guest:${item.product_id}`,
    product_id: item.product_id,
    products: item.products ?? null,
  }));
}

function extractTogglePayload(input: WishlistToggleInput): {
  productId: string;
  snapshot: WishlistProduct | null;
} {
  if (typeof input === "string") {
    return {
      productId: input,
      snapshot: null,
    };
  }

  return {
    productId: input.id,
    snapshot: {
      id: input.id,
      name: input.name ?? null,
      slug: input.slug ?? null,
      image_url: input.image_url ?? null,
      base_price_cents: input.base_price_cents ?? null,
    },
  };
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
          const guestItems = readGuestWishlist();
          set({ items: guestItemsFromStorage(guestItems), notice: null });
          return;
        }

        let items = await fetchWishlist();
        const guestItems = readGuestWishlist();

        if (guestItems.length > 0) {
          const existing = new Set(items.map((item) => item.product_id));

          for (const guestItem of guestItems) {
            if (existing.has(guestItem.product_id)) continue;
            await addToServerWishlist(guestItem.product_id);
          }

          localStorage.removeItem(GUEST_WISHLIST_KEY);
          items = await fetchWishlist();
          set({ notice: { type: "info", message: "Guest wishlist merged into your account." } });
        } else {
          set({ notice: null });
        }

        set({ items });
      } catch {
        const fallback = userId ? [] : guestItemsFromStorage(readGuestWishlist());
        set({
          items: fallback,
          notice: { type: "warning", message: "Could not sync your wishlist." },
        });
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

  toggle: async (input: WishlistToggleInput) =>
    enqueue(async () => {
      const { currentUserId } = get();
      set({ syncing: true });

      try {
        const { productId, snapshot } = extractTogglePayload(input);
        const inWishlist = get().items.some((item) => item.product_id === productId);

        if (!currentUserId) {
          const stored = readGuestWishlist();
          const map = new Map(stored.map((item) => [item.product_id, item] as const));

          if (inWishlist) {
            map.delete(productId);
          } else {
            const previous = map.get(productId);
            map.set(productId, {
              product_id: productId,
              products: snapshot ?? previous?.products ?? null,
            });
          }

          const nextStored = Array.from(map.values());
          persistGuestWishlist(nextStored);
          set({ items: guestItemsFromStorage(nextStored), notice: null });
          return;
        }

        if (inWishlist) await removeFromServerWishlist(productId);
        else await addToServerWishlist(productId);

        const items = await fetchWishlist();
        set({ items, notice: null });
      } catch {
        set({
          notice: { type: "warning", message: "Unable to update wishlist. Try again." },
        });
      } finally {
        set({ syncing: false });
      }
    }),

  isInWishlist: (productId: string) =>
    get().items.some((item) => item.product_id === productId),

  dismissNotice: () => set({ notice: null }),
}));