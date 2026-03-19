import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "./add-to-cart";
import ProductReviewForm from "./product-review-form";
import { PriceDisplay } from "@/components/PriceDisplay";
import { StockBadge } from "@/components/StockBadge";
import { ProductCard } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";
import { getServerSupabase } from "@/lib/supabase";
import {
  getCompareAtPriceCents,
  getDisplayName,
  getDisplayPriceCents,
  getPrimaryImage,
  getStockCount,
} from "@/lib/catalog-presenter";
import { getProductCategoryMeta } from "@/lib/categories";

type VisibleReview = {
  id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  authorName: string;
};

function renderStars(rating: number) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await getServerSupabase();

  const { data: baseProduct, error: baseProductError } = await sb
    .from("products")
    .select("id,name,active")
    .eq("id", id)
    .maybeSingle();

  if (baseProductError || !baseProduct) {
    notFound();
  }

  const { data: product } = await sb
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("id", baseProduct.id)
    .maybeSingle();

  if (!product) {
    notFound();
  }

  const { data: reviewRows } = await sb
    .from("reviews")
    .select("id,user_id,rating,comment,status,created_at")
    .eq("product_id", baseProduct.id)
    .eq("status", "visible")
    .order("created_at", { ascending: false });

  const reviewUserIds = Array.from(
    new Set((reviewRows ?? []).map((review) => review.user_id).filter(Boolean))
  );

  const { data: reviewProfiles } =
    reviewUserIds.length > 0
      ? await sb
          .from("profiles")
          .select("user_id,first_name,last_name")
          .in("user_id", reviewUserIds)
      : {
          data: [] as Array<{
            user_id: string;
            first_name: string | null;
            last_name: string | null;
          }>,
        };

  const profileMap = new Map(
    (reviewProfiles ?? []).map((profile) => [
      profile.user_id,
      [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Verified customer",
    ])
  );

  const visibleReviews: VisibleReview[] = (reviewRows ?? []).map((review) => ({
    id: review.id,
    user_id: review.user_id,
    rating: review.rating,
    comment: review.comment,
    created_at: review.created_at,
    authorName: profileMap.get(review.user_id) ?? "Verified customer",
  }));

  const {
    data: { user },
  } = await sb.auth.getUser();

  let canReview = false;
  let existingReview: { rating: number; comment: string; status: string } | null = null;

  if (user) {
    const [{ data: orders }, { data: ownReview }] = await Promise.all([
      sb
        .from("orders")
        .select("id,order_items(product_id)")
        .eq("user_id", user.id)
        .eq("status", "paid"),
      sb
        .from("reviews")
        .select("rating,comment,status")
        .eq("product_id", baseProduct.id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    canReview = (orders ?? []).some(
      (order: { order_items: Array<{ product_id: string }> }) =>
        order.order_items.some((item: { product_id: string }) => item.product_id === baseProduct.id)
    );

    existingReview = ownReview
      ? {
          rating: ownReview.rating,
          comment: ownReview.comment,
          status: ownReview.status,
        }
      : null;
  }

  const images = (product.images ?? []).sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  );
  const image = getPrimaryImage(product);
  const price = getDisplayPriceCents(product);
  const compareAt = getCompareAtPriceCents(product, price);
  const stock = getStockCount(product);
  const name = getDisplayName(product);
  const categoryMeta = getProductCategoryMeta(product);
  const category = categoryMeta.name;

  const averageRating = visibleReviews.length
    ? visibleReviews.reduce((acc, review) => acc + review.rating, 0) / visibleReviews.length
    : 0;

  const { data: related } = await sb
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("active", true)
    .neq("id", baseProduct.id)
    .limit(4);

  return (
    <div className="space-y-8">
      <nav className="text-sm text-mutedText">
        <Link href="/" className="hover:text-brand-primary">
          Home
        </Link>{" "}
        /{" "}
        <Link href="/shop" className="hover:text-brand-primary">
          Shop
        </Link>{" "}
        /{" "}
        <Link href={`/shop?category=${categoryMeta.slug}`} className="hover:text-brand-primary">
          {category}
        </Link>{" "}
        / <span>{name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-uiBorder bg-surface">
            <ProductImage
              src={image.primary}
              alt={name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              className="object-cover"
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            {images.slice(0, 4).map((item: { id: string; url: string }, index: number) => (
              <div
                key={item.id ?? index}
                className="relative aspect-square overflow-hidden rounded-lg border border-uiBorder bg-surface"
              >
                <Image
                  src={item.url}
                  alt={`${name} ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="25vw"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-uiBorder bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-mutedText">{category}</p>
          <h1 className="text-3xl font-bold text-brand-ink">{name}</h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-mutedText">
            <span className="text-base font-semibold text-brand-ink">
              {visibleReviews.length ? `${averageRating.toFixed(1)} / 5` : "No reviews yet"}
            </span>
            <span>{visibleReviews.length} verified reviews</span>
          </div>

          {price ? (
            <PriceDisplay priceCents={price} compareAtPriceCents={compareAt} />
          ) : (
            <p className="text-sm font-semibold text-brand-primary">Price available at checkout</p>
          )}

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
            <p className="mt-2 text-sm text-mutedText">
              {product.description ?? "Detailed product copy will be updated as content becomes available."}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Specifications</h2>
            <div className="mt-2 grid gap-2 text-sm text-mutedText">
              <p>
                <span className="font-medium text-brand-ink">Category:</span> {category}
              </p>
              <p>
                <span className="font-medium text-brand-ink">Condition:</span> {product.condition ?? "New"}
              </p>
              <p>
                <span className="font-medium text-brand-ink">Inventory status:</span>{" "}
                {stock > 0 ? "Available" : "Out of stock"}
              </p>
            </div>
          </section>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-2xl border border-uiBorder bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-brand-ink">Customer reviews</h2>
              <p className="mt-1 text-sm text-mutedText">
                {visibleReviews.length
                  ? `${visibleReviews.length} verified customer review${visibleReviews.length === 1 ? "" : "s"}`
                  : "This product does not have visible reviews yet."}
              </p>
            </div>
            {visibleReviews.length ? (
              <div className="rounded-xl bg-surfaceMuted px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-wide text-mutedText">Average rating</p>
                <p className="text-lg font-bold text-brand-ink">{averageRating.toFixed(1)} / 5</p>
              </div>
            ) : null}
          </div>

          {visibleReviews.length ? (
            <div className="space-y-4">
              {visibleReviews.map((review) => (
                <article key={review.id} className="rounded-xl border border-uiBorder p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-brand-ink">{review.authorName}</p>
                      <p className="text-sm text-amber-500">{renderStars(review.rating)}</p>
                    </div>
                    <p className="text-xs text-mutedText">{formatReviewDate(review.created_at)}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-mutedText">{review.comment}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-uiBorder p-6 text-sm text-mutedText">
              Be the first verified customer to review this product.
            </div>
          )}
        </div>

        <ProductReviewForm
          productId={baseProduct.id}
          isAuthenticated={Boolean(user)}
          canReview={canReview}
          existingReview={existingReview}
        />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Related products</h2>
          <Link href="/shop" className="text-sm font-medium text-brand-primary hover:underline">
            View all
          </Link>
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