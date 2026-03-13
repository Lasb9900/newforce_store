"use client";

import { create } from "zustand";
import { CartItem } from "@/lib/types";

type CartState = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQty: (index: number, qty: number) => void;
  remove: (index: number) => void;
  clear: () => void;
  hydrate: () => void;
};

const KEY = "nf_cart";

function persist(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (item) => {
    const items = [...get().items];
    const existingIndex = items.findIndex(
      (current) => (current.variantId && current.variantId === item.variantId) || (!current.variantId && current.productId === item.productId),
    );

    if (existingIndex >= 0) {
      items[existingIndex] = {
        ...items[existingIndex],
        qty: items[existingIndex].qty + item.qty,
      };
    } else {
      items.push(item);
    }

    persist(items);
    set({ items });
  },
  updateQty: (index, qty) => {
    const items = [...get().items];
    items[index].qty = Math.max(1, qty);
    persist(items);
    set({ items });
  },
  remove: (index) => {
    const items = get().items.filter((_, itemIndex) => itemIndex !== index);
    persist(items);
    set({ items });
  },
  clear: () => {
    localStorage.removeItem(KEY);
    set({ items: [] });
  },
  hydrate: () => {
    const raw = localStorage.getItem(KEY);
    if (raw) set({ items: JSON.parse(raw) as CartItem[] });
  },
}));
