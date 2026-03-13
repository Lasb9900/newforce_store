import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "./add-to-cart";
import { PriceDisplay } from "@/components/PriceDisplay";
import { StockBadge } from "@/components/StockBadge";
import { ProductCard } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";
import { getServerSupabase } from "@/lib/supabase";
import { getCompareAtPriceCents, getDisplayCategory, getDisplayName, getDisplayPriceCents, getPrimaryImage, getStockCount } from "@/lib/catalog-presenter";

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
  const image = getPrimaryImage(product);
  const visibleReviews = (product.reviews ?? []).filter((review: { status: string }) => review.status === "visible");
  const price = getDisplayPriceCents(product);
  const compareAt = getCompareAtPriceCents(product, price);
  const stock = getStockCount(product);
  const name = getDisplayName(product);
  const category = getDisplayCategory(product);

  const { data: related } = await sb
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("active", true)
    .neq("id", id)
    .limit(4);

  return (
    <div className="space-y-8">
      <nav className="text-sm text-mutedText">
        <Link href="/" className="hover:text-brand-primary">Home</Link> / <Link href="/shop" className="hover:text-brand-primary">Shop</Link> / <span>{name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-uiBorder bg-surface">
            <ProductImage src={image.primary} alt={name} fill sizes="(max-width: 1024px) 100vw, 50vw" priority className="object-cover" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {images.slice(0, 4).map((item: { id: string; url: string }, index: number) => (
              <div key={item.id ?? index} className="relative aspect-square overflow-hidden rounded-lg border border-uiBorder bg-surface">
                <Image src={item.url} alt={`${name} ${index + 1}`} fill className="object-cover" sizes="25vw" unoptimized />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-uiBorder bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-mutedText">{category}</p>
          <h1 className="text-3xl font-bold text-brand-ink">{name}</h1>
          <p className="text-sm text-mutedText">{visibleReviews.length} verified reviews</p>

          {price ? <PriceDisplay priceCents={price} compareAtPriceCents={compareAt} /> : <p className="text-sm font-semibold text-brand-primary">Price available at checkout</p>}
          <StockBadge stock={stock} />
          <p className="text-sm text-mutedText">SKU: {product.sku ?? "N/A"}</p>

          <AddToCart product={product} />

          <div className="rounded-xl bg-surfaceMuted p-4 text-sm text-mutedText">
            <p className="font-semibold text-brand-ink">Shipping & Returns</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Fast shipping with tracking</li>
              <li>30-day returns on eligible items</li>
              <li>Secure checkout and encrypted payments</li>
            </ul>
          </div>

          <section>
            <h2 className="text-lg font-semibold">Description</h2>
            <p className="mt-2 text-sm text-mutedText">{product.description ?? "Detailed product copy will be updated as content becomes available."}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Specifications</h2>
            <div className="mt-2 grid gap-2 text-sm text-mutedText">
              <p><span className="font-medium text-brand-ink">Category:</span> {category}</p>
              <p><span className="font-medium text-brand-ink">Condition:</span> {product.condition ?? "New"}</p>
              <p><span className="font-medium text-brand-ink">Inventory status:</span> {stock > 0 ? "Available" : "Out of stock"}</p>
            </div>
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
