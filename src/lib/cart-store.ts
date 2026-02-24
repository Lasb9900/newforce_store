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

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (item) => {
    const items = [...get().items, item];
    localStorage.setItem(KEY, JSON.stringify(items));
    set({ items });
  },
  updateQty: (index, qty) => {
    const items = [...get().items];
    items[index].qty = qty;
    localStorage.setItem(KEY, JSON.stringify(items));
    set({ items });
  },
  remove: (index) => {
    const items = get().items.filter((_, i) => i !== index);
    localStorage.setItem(KEY, JSON.stringify(items));
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
