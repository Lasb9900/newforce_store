export const formatCurrency = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

export const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");
