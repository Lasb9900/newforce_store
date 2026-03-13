import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "./add-to-cart";
import { RatingStars } from "@/components/RatingStars";
import { PriceDisplay } from "@/components/PriceDisplay";
import { StockBadge } from "@/components/StockBadge";
import { ProductCard } from "@/components/ProductCard";
import { getServerSupabase } from "@/lib/supabase";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await getServerSupabase();
  const { data: product } = await sb
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*), reviews(rating,comment,status)")
    .eq("id", id)
    .single();

  if (!product) notFound();

  const images = (product.images ?? []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);
  const cover = images[0]?.url ?? product.image_url ?? "https://placehold.co/800x800?text=Product";
  const visibleReviews = (product.reviews ?? []).filter((review: { status: string }) => review.status === "visible");
  const avg = visibleReviews.length
    ? visibleReviews.reduce((sum: number, review: { rating: number }) => sum + review.rating, 0) / visibleReviews.length
    : 0;

  const { data: related } = await sb
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("active", true)
    .neq("id", id)
    .limit(4);

  const price = product.base_price_cents ?? 0;

  return (
    <div className="space-y-8">
      <nav className="text-sm text-mutedText">
        <Link href="/" className="hover:text-brand-primary">Home</Link> / <Link href="/shop" className="hover:text-brand-primary">Shop</Link> / <span>{product.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-uiBorder bg-surface">
            <Image src={cover} alt={product.name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" priority />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {images.slice(0, 4).map((image: { id: string; url: string }, index: number) => (
              <div key={image.id ?? index} className="relative aspect-square overflow-hidden rounded-lg border border-uiBorder bg-surface">
                <Image src={image.url} alt={`${product.name} ${index + 1}`} fill className="object-cover" sizes="25vw" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-uiBorder bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-mutedText">{product.category?.name ?? product.department ?? "General"}</p>
          <h1 className="text-3xl font-bold text-brand-ink">{product.name}</h1>
          <div className="flex items-center gap-3">
            <RatingStars rating={avg || 4.6} />
            <span className="text-sm text-mutedText">{visibleReviews.length || 0} reviews</span>
          </div>

          <PriceDisplay priceCents={price} compareAtPriceCents={product.price_cents} />
          <StockBadge stock={product.base_stock ?? product.qty ?? 0} />
          <p className="text-sm text-mutedText">SKU: {product.sku ?? "N/A"}</p>

          <AddToCart product={product} />

          <div className="rounded-xl bg-surfaceMuted p-4 text-sm text-mutedText">
            <p className="font-semibold text-brand-ink">Why buy with us?</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Secure payments and encrypted checkout</li>
              <li>Fast shipping and tracking updates</li>
              <li>30-day return policy</li>
            </ul>
          </div>

          <section>
            <h2 className="text-lg font-semibold">Description</h2>
            <p className="mt-2 text-sm text-mutedText">{product.description ?? "No description available yet."}</p>
          </section>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Related products</h2>
          <Link href="/shop" className="text-sm font-medium text-brand-primary hover:underline">View all</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(related ?? []).map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
