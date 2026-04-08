import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;

  const { id: productId } = await params;
  const service = getServiceSupabase();

  const body = await req.json().catch(() => null);
  const images = Array.isArray(body?.images) ? body.images : null;

  if (!images || images.length === 0) {
    return NextResponse.json({ error: "Debes enviar la lista de imágenes" }, { status: 400 });
  }

  const normalized = images.map((img: { id: string }, index: number) => ({
    id: img.id,
    sort_order: index,
  }));

  for (const img of normalized) {
    const { error } = await service
      .from("product_images")
      .update({ sort_order: img.sort_order })
      .eq("id", img.id)
      .eq("product_id", productId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const { data: updatedImages, error: fetchError } = await service
    .from("product_images")
    .select("id,url,sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }

  const primaryUrl = updatedImages?.[0]?.url ?? null;

  const { error: productUpdateError } = await service
    .from("products")
    .update({ image_url: primaryUrl })
    .eq("id", productId);

  if (productUpdateError) {
    return NextResponse.json({ error: productUpdateError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      images: updatedImages ?? [],
      primaryUrl,
    },
  });
}