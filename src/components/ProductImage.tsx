import Image from "next/image";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

export function ProductImage({ src, alt, fill, className, sizes, priority }: ProductImageProps) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Premium Catalog</p>
          <p className="mt-1 text-sm font-medium text-slate-600">Image coming soon</p>
        </div>
      </div>
    );
  }

  return <Image src={src} alt={alt} fill={fill} className={className ?? "object-cover"} sizes={sizes} priority={priority} unoptimized />;
}
