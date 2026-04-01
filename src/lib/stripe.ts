import Stripe from "stripe";
import { serverEnv } from "@/lib/server-env";

export const stripe = serverEnv.STRIPE_SECRET_KEY
  ? new Stripe(serverEnv.STRIPE_SECRET_KEY, { apiVersion: "2026-01-28.clover" })
  : null;
