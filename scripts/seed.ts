import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const categories = ["TVs", "Washers", "Audio", "Gaming"].map((name) => ({ name, slug: name.toLowerCase() }));
  await supabase.from("categories").upsert(categories, { onConflict: "slug" });
  const { data: categoryRows } = await supabase.from("categories").select("id,name");
  const byName = Object.fromEntries((categoryRows ?? []).map((c) => [c.name, c.id]));

  const products = Array.from({ length: 12 }).map((_, i) => ({
    name: `Producto ${i + 1}`,
    description: `Descripción demo para producto ${i + 1}`,
    category_id: byName[["TVs", "Washers", "Audio", "Gaming"][i % 4]],
    base_price_cents: i < 6 ? (i + 1) * 12000 : null,
    base_stock: i < 6 ? 10 + i : 0,
    has_variants: i >= 6,
    active: true,
    featured: i < 4,
    featured_rank: i < 4 ? i + 1 : 0,
    tags: ["demo", i % 2 === 0 ? "popular" : "new"],
    sku: `SKU-${1000 + i}`,
  }));

  const { data: inserted } = await supabase.from("products").insert(products).select();
  for (const p of inserted ?? []) {
    await supabase.from("product_images").insert({ product_id: p.id, url: `https://placehold.co/800x600?text=${encodeURIComponent(p.name)}`, sort_order: 0 });
    if (p.has_variants) {
      await supabase.from("product_variants").insert([
        { product_id: p.id, variant_name: "Small", attributes: { size: "small" }, price_cents: 25000, stock: 8, sku: `${p.sku}-S` },
        { product_id: p.id, variant_name: "Large", attributes: { size: "large" }, price_cents: 35000, stock: 6, sku: `${p.sku}-L` },
      ]);
    }
  }

  console.log("Seed complete");
}

run();
