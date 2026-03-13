import { AddressSuggestion, getAddressSuggestions } from "@/lib/us-address";

export async function autocompleteUsAddress(query: string): Promise<AddressSuggestion[]> {
  // Prepared for external providers (Google Places, Smarty, etc.)
  // Current fallback uses local curated suggestions for UX continuity.
  return getAddressSuggestions(query);
}
