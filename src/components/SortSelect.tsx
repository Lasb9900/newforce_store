import { SORT_OPTIONS } from "@/lib/shop";

type SortSelectProps = {
  currentSort: string;
};

export function SortSelect({ currentSort }: SortSelectProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-mutedText">
      <span className="whitespace-nowrap">Sort by</span>
      <select name="sort" defaultValue={currentSort} className="rounded-lg border border-uiBorder bg-white px-3 py-2 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-primary/20">
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
