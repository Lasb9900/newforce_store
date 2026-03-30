"use client";

import { useMemo, useState } from "react";
import { ProductImage } from "@/components/ProductImage";

type GalleryImage = {
  id?: string | null;
  url?: string | null;
  sort_order?: number | null;
};

type ProductGalleryProps = {
  name: string;
  primaryImage?: string | null;
  images?: GalleryImage[] | null;
};

export default function ProductGallery({
  name,
  primaryImage,
  images,
}: ProductGalleryProps) {
  const normalizedImages = useMemo(() => {
    const safeImages = images ?? [];

    const all = [
      ...(primaryImage
        ? [{ id: "primary-image", url: primaryImage, sort_order: -1 }]
        : []),
      ...safeImages,
    ]
      .filter(
        (item): item is Required<Pick<GalleryImage, "url">> & GalleryImage =>
          Boolean(item?.url)
      )
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const seen = new Set<string>();

    return all.filter((item) => {
      const key = String(item.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [primaryImage, images]);

  const [activeIndex, setActiveIndex] = useState(0);

  const safeActiveIndex =
    normalizedImages.length === 0
      ? 0
      : Math.min(activeIndex, normalizedImages.length - 1);

  const activeImage =
    normalizedImages[safeActiveIndex]?.url ?? primaryImage ?? null;

  const hasMultiple = normalizedImages.length > 1;

  const goToPrevious = () => {
    if (!normalizedImages.length) return;

    setActiveIndex((current) =>
      current <= 0 ? normalizedImages.length - 1 : current - 1
    );
  };

  const goToNext = () => {
    if (!normalizedImages.length) return;

    setActiveIndex((current) =>
      current >= normalizedImages.length - 1 ? 0 : current + 1
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-uiBorder bg-surface">
        <ProductImage
          src={activeImage}
          alt={name}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="object-cover"
        />

        {hasMultiple ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={goToPrevious}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/30 bg-black/45 px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-black/60"
            >
              ‹
            </button>

            <button
              type="button"
              aria-label="Next image"
              onClick={goToNext}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/30 bg-black/45 px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-black/60"
            >
              ›
            </button>

            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur-sm">
              {normalizedImages.map((item, index) => (
                <button
                  key={item.id ?? `${item.url}-${index}`}
                  type="button"
                  aria-label={`View image ${index + 1}`}
                  onClick={() => setActiveIndex(index)}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    index === safeActiveIndex
                      ? "bg-white"
                      : "bg-white/45 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {normalizedImages.length > 0 ? (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {normalizedImages.map((item, index) => {
            const selected = index === safeActiveIndex;

            return (
              <button
                key={item.id ?? `${item.url}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Select image ${index + 1}`}
                className={`relative aspect-square overflow-hidden rounded-xl border bg-surface transition ${
                  selected
                    ? "border-brand-primary ring-2 ring-brand-primary/20"
                    : "border-uiBorder hover:border-brand-primary/40"
                }`}
              >
                <ProductImage
                  src={item.url ?? null}
                  alt={`${name} ${index + 1}`}
                  fill
                  sizes="20vw"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}