import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { serverEnv } from "@/lib/server-env";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const formData = await req.formData();

  const manyFiles = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  const singleFile = formData.get("file");
  const files =
    manyFiles.length > 0
      ? manyFiles
      : singleFile instanceof File
        ? [singleFile]
        : [];

  if (!files.length) {
    return NextResponse.json({ error: "Debes enviar al menos una imagen" }, { status: 400 });
  }

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa jpg, jpeg, png o webp" },
        { status: 400 },
      );
    }
  }

  const service = getServiceSupabase();

  const { data: existingImages, error: existingError } = await service
    .from("product_images")
    .select("id,url,sort_order")
    .eq("product_id", id)
    .order("sort_order", { ascending: true });

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  const startSortOrder =
    existingImages && existingImages.length > 0
      ? Math.max(...existingImages.map((img) => img.sort_order ?? 0)) + 1
      : 0;

  const uploadedRows: Array<{ product_id: string; url: string; sort_order: number }> = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `products/${id}/${Date.now()}-${index}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await service.storage
      .from(serverEnv.SUPABASE_STORAGE_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const { data: publicData } = service.storage
      .from(serverEnv.SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(path);

    uploadedRows.push({
      product_id: id,
      url: publicData.publicUrl,
      sort_order: startSortOrder + index,
    });
  }

  const { data: insertedImages, error: insertError } = await service
    .from("product_images")
    .insert(uploadedRows)
    .select("id,url,sort_order");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const allImages = [...(existingImages ?? []), ...(insertedImages ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  const primaryUrl = allImages[0]?.url ?? null;

  const { error: productUpdateError } = await service
    .from("products")
    .update({ image_url: primaryUrl })
    .eq("id", id);

  if (productUpdateError) {
    return NextResponse.json({ error: productUpdateError.message }, { status: 400 });
  }

  return NextResponse.json({
    data: {
      uploaded: insertedImages ?? [],
      images: allImages,
      primaryUrl,
    },
  });
}