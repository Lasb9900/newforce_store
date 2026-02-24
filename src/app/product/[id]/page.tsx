import { notFound } from "next/navigation";
import { AddToCart } from "./add-to-cart";
import { RatingStars } from "@/components/RatingStars";
import { createSupabaseServer } from "@/lib/supabase";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createSupabaseServer();
  const { data: product } = await sb
    .from("products")
    .select("*, images:product_images(*), variants:product_variants(*), reviews(rating,comment,status)")
    .eq("id", id)
    .single();
  if (!product) notFound();
  const visibleReviews = (product.reviews ?? []).filter((r: { status: string }) => r.status === "visible");
  const avg = visibleReviews.length ? visibleReviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / visibleReviews.length : 0;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <img src={product.images?.[0]?.url ?? "https://placehold.co/800x600"} alt={product.name} className="w-full rounded" />
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">{product.name}</h1>
        <p>{product.description}</p>
        <RatingStars rating={avg} />
        <AddToCart product={product} />
      </div>
    </div>
  );
}
