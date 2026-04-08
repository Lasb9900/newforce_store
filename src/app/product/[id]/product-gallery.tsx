"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  useEffect(() => {
    if (!lightboxOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxOpen(false);
      } else if (event.key === "ArrowLeft") {
        goToPrevious();
      } else if (event.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen, normalizedImages.length]);

  return (
    <>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            if (activeImage) setLightboxOpen(true);
          }}
          className="relative block aspect-square w-full overflow-hidden rounded-2xl border border-uiBorder bg-surface"
          aria-label="Open image gallery"
        >
          <ProductImage
            src={activeImage}
            alt={name}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            className="object-cover"
          />

          <div className="absolute bottom-3 right-3 z-10 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            Click to zoom
          </div>

          {hasMultiple ? (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/30 bg-black/45 px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-black/60"
              >
                ‹
              </button>

              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIndex(index);
                    }}
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
        </button>

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

      {lightboxOpen && activeImage ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            aria-label="Close gallery"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-sm font-semibold text-white hover:bg-black/70"
          >
            ✕
          </button>

          {hasMultiple ? (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 px-4 py-3 text-xl font-semibold text-white hover:bg-black/70"
              >
                ‹
              </button>

              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 px-4 py-3 text-xl font-semibold text-white hover:bg-black/70"
              >
                ›
              </button>
            </>
          ) : null}

          <div
            className="relative h-[80vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <ProductImage
              src={activeImage}
              alt={name}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>

          {normalizedImages.length > 1 ? (
            <div
              className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-2xl bg-black/60 px-3 py-2 backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {normalizedImages.map((item, index) => (
                <button
                  key={item.id ?? `${item.url}-lightbox-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`relative h-14 w-14 overflow-hidden rounded-lg border ${
                    index === safeActiveIndex
                      ? "border-white"
                      : "border-white/20"
                  }`}
                  aria-label={`Open image ${index + 1}`}
                >
                  <ProductImage
                    src={item.url ?? null}
                    alt={`${name} preview ${index + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}