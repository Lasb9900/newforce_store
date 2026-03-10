import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Debes enviar una imagen" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Formato no permitido. Usa jpg, jpeg, png o webp" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `products/${id}/${Date.now()}.${ext}`;

  const service = getServiceSupabase();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await service.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: publicData } = service.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
  const imageUrl = publicData.publicUrl;

  // keep a single primary image (sort_order=0)
  await service.from("product_images").delete().eq("product_id", id).eq("sort_order", 0);
  const { data: imageRow, error: imageError } = await service
    .from("product_images")
    .insert({ product_id: id, url: imageUrl, sort_order: 0 })
    .select("id,url,sort_order")
    .single();

  if (imageError) return NextResponse.json({ error: imageError.message }, { status: 400 });

  const { error: productUpdateError } = await service.from("products").update({ image_url: imageUrl }).eq("id", id);
  if (productUpdateError) return NextResponse.json({ error: productUpdateError.message }, { status: 400 });

  return NextResponse.json({ data: imageRow });
}
