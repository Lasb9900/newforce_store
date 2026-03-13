export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
] as const;

export const US_STATE_CODES = US_STATES.map((state) => state.code);
export const US_STATE_SET = new Set<string>(US_STATE_CODES);
export const US_ZIP_REGEX = /^\d{5}(?:-\d{4})?$/;

export type AddressSuggestion = {
  line1: string;
  city: string;
  state: (typeof US_STATES)[number]["code"];
  postal_code: string;
};

const MOCK_US_ADDRESS_BOOK: AddressSuggestion[] = [
  { line1: "123 Main St", city: "Miami", state: "FL", postal_code: "33101" },
  { line1: "123 Main St", city: "Orlando", state: "FL", postal_code: "32801" },
  { line1: "550 Market St", city: "San Francisco", state: "CA", postal_code: "94105" },
  { line1: "742 Evergreen Terrace", city: "Austin", state: "TX", postal_code: "73301" },
  { line1: "405 Lexington Ave", city: "New York", state: "NY", postal_code: "10174" },
];

export function getAddressSuggestions(query: string) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 4) return [];

  return MOCK_US_ADDRESS_BOOK.filter((entry) =>
    `${entry.line1} ${entry.city} ${entry.state}`.toLowerCase().includes(normalized),
  ).slice(0, 5);
}

export function getStateLabel(code: string) {
  const match = US_STATES.find((state) => state.code === code);
  return match ? `${match.name} (${match.code})` : code;
}
