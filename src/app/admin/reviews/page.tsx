import { requireOwnerPage } from "@/lib/auth";
import ReviewsManager from "./reviews-manager";

type RawAdminReviewRow = {
  id: string;
  comment: string;
  rating: number;
  status: string;
  product_id: string;
  created_at: string;
  product:
    | {
        id: string;
        name: string | null;
        sku: string | null;
      }
    | {
        id: string;
        name: string | null;
        sku: string | null;
      }[]
    | null;
};

export default async function AdminReviewsPage() {
  const { supabase } = await requireOwnerPage();

  const { data, error } = await supabase
    .from("reviews")
    .select(`
      id,
      comment,
      rating,
      status,
      product_id,
      created_at,
      product:products (
        id,
        name,
        sku
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as RawAdminReviewRow[];

  const reviews = rows.map((review) => {
    const product = Array.isArray(review.product) ? review.product[0] ?? null : review.product;

    return {
      id: review.id,
      comment: review.comment,
      rating: review.rating,
      status: review.status,
      productId: review.product_id,
      createdAt: review.created_at,
      productName: product?.name ?? "Producto sin nombre",
      productSku: product?.sku ?? null,
    };
  });

  return (
    <div className="space-y-4 rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Reviews</h1>
        <p className="text-sm text-mutedText">
          Aquí puedes revisar, ocultar y volver a mostrar comentarios de clientes.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Error cargando reviews: {error.message}
        </p>
      ) : null}

      <ReviewsManager reviews={reviews} />
    </div>
  );
}