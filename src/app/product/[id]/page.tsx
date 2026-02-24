import Image from "next/image";
import { notFound } from "next/navigation";
import { AddToCart } from "./add-to-cart";
import { RatingStars } from "@/components/RatingStars";
import { getServerSupabase } from "@/lib/supabase";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await getServerSupabase();
  const { data: product } = await sb
    .from("products")
    .select("*, images:product_images(*), variants:product_variants(*), reviews(rating,comment,status)")
    .eq("id", id)
    .single();

  if (!product) notFound();

  const visibleReviews = (product.reviews ?? []).filter((r: { status: string }) => r.status === "visible");
  const avg = visibleReviews.length
    ? visibleReviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / visibleReviews.length
    : 0;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="relative h-[420px] w-full overflow-hidden rounded bg-white">
        <Image
          src={product.images?.[0]?.url ?? "https://placehold.co/800x600"}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-3xl font-bold">{product.name}</h1>
        <p className="text-slate-700">{product.description}</p>
        <RatingStars rating={avg} />
        <AddToCart product={product} />
      </div>
    </div>
  );
}
