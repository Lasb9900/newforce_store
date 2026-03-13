export default function LoadingShop() {
  return (
    <div className="space-y-6">
      <div className="h-12 animate-pulse rounded-2xl bg-slate-200" />
      <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        <div className="hidden h-96 animate-pulse rounded-2xl bg-slate-100 md:block" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-80 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
