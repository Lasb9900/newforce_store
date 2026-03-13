"use client";

import { create } from "zustand";
import { CartItem } from "@/lib/types";
import { useAuthStore } from "@/lib/auth-store";

type CartNotice = { type: "info" | "warning"; message: string };

type CartState = {
  items: CartItem[];
  initialized: boolean;
  initializing: boolean;
  syncing: boolean;
  currentUserId: string | null;
  notice: CartNotice | null;
  initialize: () => Promise<void>;
  dismissNotice: () => void;
  addItem: (item: CartItem) => Promise<void>;
  updateQty: (itemKey: string, qty: number) => Promise<void>;
  remove: (itemKey: string) => Promise<void>;
  clear: () => Promise<void>;
};

const GUEST_KEY = "cart:guest";
let authSubscriptionBound = false;
let operationQueue = Promise.resolve();

function getItemKey(item: Pick<CartItem, "productId" | "variantId">) {
  return item.variantId ? `variant:${item.variantId}` : `product:${item.productId}`;
}

function readGuestCart() {
  if (typeof window === "undefined") return [] as CartItem[];
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistGuestCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  if (!items.length) {
    localStorage.removeItem(GUEST_KEY);
    return;
  }
  localStorage.setItem(GUEST_KEY, JSON.stringify(items));
}

function enqueueOperation(task: () => Promise<void>) {
  operationQueue = operationQueue.then(task, task);
  return operationQueue;
}

async function fetchServerCart() {
  const response = await fetch("/api/cart", { cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    throw new Error(payload?.message ?? payload?.error ?? "Failed to load account cart");
  }
  return (await response.json()) as { data: CartItem[]; notices?: CartNotice[] };
}

async function persistServerCart(items: CartItem[]) {
  const response = await fetch("/api/cart", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: items.map(({ productId, variantId, qty }) => ({ productId, variantId, qty })) }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    throw new Error(payload?.message ?? payload?.error ?? "Failed to update account cart");
  }
  return (await response.json()) as { data: CartItem[]; notices?: CartNotice[] };
}

async function mergeGuestIntoServer(guestItems: CartItem[]) {
  const response = await fetch("/api/cart/merge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ guestItems: guestItems.map(({ productId, variantId, qty }) => ({ productId, variantId, qty })) }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    throw new Error(payload?.message ?? payload?.error ?? "Failed to merge guest cart");
  }
  return (await response.json()) as { data: CartItem[]; notices?: CartNotice[] };
}

function clampQty(qty: number, stock?: number | null) {
  const value = Math.max(1, Math.trunc(Number(qty) || 1));
  if (typeof stock === "number") return Math.min(value, Math.max(stock, 1));
  return value;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  initialized: false,
  initializing: false,
  syncing: false,
  currentUserId: null,
  notice: null,

  initialize: async () => {
    if (get().initialized || get().initializing) return;

    set({ initializing: true });

    const applyForUser = async (nextUserId: string | null) => {
      set({ syncing: true, currentUserId: nextUserId, items: [] });
      try {
        if (!nextUserId) {
          set({ items: readGuestCart(), notice: null });
          return;
        }

        const guestItems = readGuestCart();
        if (guestItems.length) {
          const merged = await mergeGuestIntoServer(guestItems);
          localStorage.removeItem(GUEST_KEY);
          set({ items: merged.data, notice: merged.notices?.[0] ?? null });
          return;
        }

        const serverCart = await fetchServerCart();
        set({ items: serverCart.data, notice: serverCart.notices?.[0] ?? null });
      } catch (error) {
        set({ items: nextUserId ? [] : readGuestCart(), notice: { type: "warning", message: error instanceof Error ? error.message : "Could not sync your cart. Please retry." } });
      } finally {
        set({ syncing: false });
      }
    };

    const auth = useAuthStore.getState();
    await auth.initialize();
    const userId = useAuthStore.getState().userId;
    await applyForUser(userId);

    if (!authSubscriptionBound) {
      useAuthStore.subscribe((state, prev) => {
        if (state.userId === prev.userId) return;
        void applyForUser(state.userId);
      });
      authSubscriptionBound = true;
    }

    set({ initialized: true, initializing: false });
  },

  dismissNotice: () => set({ notice: null }),

  addItem: async (item) =>
    enqueueOperation(async () => {
      const { currentUserId } = get();
      set({ syncing: true });
      try {
        const byKey = new Map(get().items.map((entry) => [getItemKey(entry), entry]));
        const key = getItemKey(item);
        const existing = byKey.get(key);
        const qty = clampQty((existing?.qty ?? 0) + Math.max(1, item.qty), item.availableStock ?? existing?.availableStock);
        byKey.set(key, { ...existing, ...item, qty });
        const nextItems = Array.from(byKey.values());

        if (!currentUserId) {
          persistGuestCart(nextItems);
          set({ items: nextItems, notice: null });
          return;
        }

        const result = await persistServerCart(nextItems);
        set({ items: result.data, notice: result.notices?.[0] ?? null });
      } finally {
        set({ syncing: false });
      }
    }),

  updateQty: async (itemKey, qty) =>
    enqueueOperation(async () => {
      const { currentUserId } = get();
      set({ syncing: true });
      try {
        const nextItems = get().items.map((item) => (getItemKey(item) === itemKey ? { ...item, qty: clampQty(qty, item.availableStock) } : item));

        if (!currentUserId) {
          persistGuestCart(nextItems);
          set({ items: nextItems, notice: null });
          return;
        }

        const result = await persistServerCart(nextItems);
        set({ items: result.data, notice: result.notices?.[0] ?? null });
      } finally {
        set({ syncing: false });
      }
    }),

  remove: async (itemKey) =>
    enqueueOperation(async () => {
      const { currentUserId } = get();
      set({ syncing: true });
      try {
        const nextItems = get().items.filter((item) => getItemKey(item) !== itemKey);

        if (!currentUserId) {
          persistGuestCart(nextItems);
          set({ items: nextItems, notice: null });
          return;
        }

        const result = await persistServerCart(nextItems);
        set({ items: result.data, notice: result.notices?.[0] ?? null });
      } finally {
        set({ syncing: false });
      }
    }),

  clear: async () =>
    enqueueOperation(async () => {
      const { currentUserId } = get();
      set({ syncing: true });
      try {
        if (!currentUserId) {
          persistGuestCart([]);
          set({ items: [], notice: null });
          return;
        }

        const result = await persistServerCart([]);
        set({ items: result.data, notice: result.notices?.[0] ?? null });
      } finally {
        set({ syncing: false });
      }
    }),
}));

export function cartItemKey(item: Pick<CartItem, "productId" | "variantId">) {
  return getItemKey(item);
}
