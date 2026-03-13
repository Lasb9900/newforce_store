import { CartItem } from "@/lib/types";

export type ShippingForm = {
  full_name: string;
  email: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: "US";
  delivery_notes: string;
};

export type ShippingOption = {
  id: "ups_ground" | "ups_2day" | "ups_next_day";
  name: string;
  amount_cents: number;
  estimated_days: string;
  label?: "Best value" | "Fastest" | "Cheapest";
};

export type CheckoutItemInput = Pick<CartItem, "productId" | "variantId" | "qty">;

export type FieldErrors = Partial<Record<keyof ShippingForm, string>>;

export const initialShippingForm: ShippingForm = {
  full_name: "",
  email: "",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
  delivery_notes: "",
};
