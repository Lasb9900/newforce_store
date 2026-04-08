import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const service = getServiceSupabase();

  const { data: imageRow, error: imageError } = await service
    .from("product_images")
    .select("id,product_id")
    .eq("id", id)
    .maybeSingle();

  if (imageError) {
    return NextResponse.json({ error: imageError.message }, { status: 400 });
  }

  if (!imageRow) {
    return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
  }

  const { error: deleteError } = await service
    .from("product_images")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  const { data: remainingImages, error: remainingError } = await service
    .from("product_images")
    .select("id,url,sort_order")
    .eq("product_id", imageRow.product_id)
    .order("sort_order", { ascending: true });

  if (remainingError) {
    return NextResponse.json({ error: remainingError.message }, { status: 400 });
  }

  const normalizedImages = (remainingImages ?? []).map((img, index) => ({
    ...img,
    sort_order: index,
  }));

  await Promise.all(
    normalizedImages.map((img) =>
      service.from("product_images").update({ sort_order: img.sort_order }).eq("id", img.id),
    ),
  );

  const primaryUrl = normalizedImages[0]?.url ?? null;

  const { error: productUpdateError } = await service
    .from("products")
    .update({ image_url: primaryUrl })
    .eq("id", imageRow.product_id);

  if (productUpdateError) {
    return NextResponse.json({ error: productUpdateError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      images: normalizedImages,
      primaryUrl,
    },
  });
}