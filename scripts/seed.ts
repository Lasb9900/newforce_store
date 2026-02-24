import { createClient } from "@supabase/supabase-js";

type CategoryName = "Laundry" | "TV & Audio" | "Kitchen" | "Small Appliances" | "Cleaning" | "Climate";

type VariantSeed = {
  variant_name: string;
  attributes: Record<string, string>;
  price_cents: number;
  stock: number;
  sku: string;
};

type ProductSeed = {
  name: string;
  description: string;
  category: CategoryName;
  tags: string[];
  sku: string;
  featured?: number;
  base_price_cents?: number;
  base_stock?: number;
  variants?: VariantSeed[];
  images: [string, string];
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const categories: Array<{ name: CategoryName; slug: string }> = [
  { name: "Laundry", slug: "laundry" },
  { name: "TV & Audio", slug: "tv-audio" },
  { name: "Kitchen", slug: "kitchen" },
  { name: "Small Appliances", slug: "small-appliances" },
  { name: "Cleaning", slug: "cleaning" },
  { name: "Climate", slug: "climate" },
];

const products: ProductSeed[] = [
  {
    name: "Lavadora Whirlpool 20kg",
    description: "Lavadora de alta capacidad con programas inteligentes de lavado.",
    category: "Laundry",
    tags: ["laundry", "washer", "whirlpool"],
    sku: "NF-WHIRLPOOL-WASHER",
    featured: 1,
    variants: [
      { variant_name: "20kg", attributes: { capacity: "20kg" }, price_cents: 69900, stock: 9, sku: "NF-WHIRLPOOL-WASHER-20" },
      { variant_name: "24kg", attributes: { capacity: "24kg" }, price_cents: 84900, stock: 7, sku: "NF-WHIRLPOOL-WASHER-24" },
    ],
    images: [
      "https://placehold.co/800x600?text=Whirlpool+Washer+Front",
      "https://placehold.co/800x600?text=Whirlpool+Washer+Panel",
    ],
  },
  {
    name: "Secadora Samsung Heat Pump",
    description: "Secadora eficiente con bomba de calor y sensor de humedad.",
    category: "Laundry",
    tags: ["laundry", "dryer", "samsung"],
    sku: "NF-SAMSUNG-DRYER",
    featured: 2,
    variants: [
      { variant_name: "7kg", attributes: { capacity: "7kg" }, price_cents: 62900, stock: 10, sku: "NF-SAMSUNG-DRYER-7" },
      { variant_name: "9kg", attributes: { capacity: "9kg" }, price_cents: 75900, stock: 6, sku: "NF-SAMSUNG-DRYER-9" },
    ],
    images: [
      "https://placehold.co/800x600?text=Samsung+Dryer+Front",
      "https://placehold.co/800x600?text=Samsung+Dryer+Door",
    ],
  },
  {
    name: "Televisor LG UHD",
    description: "TV UHD con HDR y webOS para entretenimiento completo.",
    category: "TV & Audio",
    tags: ["tv", "lg", "uhd"],
    sku: "NF-LG-UHD-TV",
    featured: 3,
    variants: [
      { variant_name: '50"', attributes: { size: '50"' }, price_cents: 49900, stock: 12, sku: "NF-LG-UHD-TV-50" },
      { variant_name: '55"', attributes: { size: '55"' }, price_cents: 59900, stock: 10, sku: "NF-LG-UHD-TV-55" },
      { variant_name: '65"', attributes: { size: '65"' }, price_cents: 79900, stock: 8, sku: "NF-LG-UHD-TV-65" },
    ],
    images: [
      "https://placehold.co/800x600?text=LG+UHD+TV+Front",
      "https://placehold.co/800x600?text=LG+UHD+TV+Living+Room",
    ],
  },
  {
    name: "Televisor Samsung QLED",
    description: "Panel QLED de alto brillo con colores vibrantes.",
    category: "TV & Audio",
    tags: ["tv", "samsung", "qled"],
    sku: "NF-SAMSUNG-QLED-TV",
    featured: 4,
    variants: [
      { variant_name: '55"', attributes: { size: '55"' }, price_cents: 89900, stock: 9, sku: "NF-SAMSUNG-QLED-TV-55" },
      { variant_name: '65"', attributes: { size: '65"' }, price_cents: 109900, stock: 5, sku: "NF-SAMSUNG-QLED-TV-65" },
    ],
    images: [
      "https://placehold.co/800x600?text=Samsung+QLED+TV+Front",
      "https://placehold.co/800x600?text=Samsung+QLED+TV+Wall",
    ],
  },
  {
    name: "Microondas Panasonic Inverter",
    description: "Microondas compacto con tecnología inverter para cocción uniforme.",
    category: "Kitchen",
    tags: ["kitchen", "microwave", "panasonic"],
    sku: "NF-PANASONIC-MW",
    base_price_cents: 18900,
    base_stock: 18,
    images: [
      "https://placehold.co/800x600?text=Panasonic+Microwave+Front",
      "https://placehold.co/800x600?text=Panasonic+Microwave+Open",
    ],
  },
  {
    name: "Nevera GE 20ft",
    description: "Refrigerador de 20 pies cúbicos con freezer superior.",
    category: "Kitchen",
    tags: ["kitchen", "refrigerator", "ge"],
    sku: "NF-GE-FRIDGE-20FT",
    base_price_cents: 99900,
    base_stock: 6,
    images: [
      "https://placehold.co/800x600?text=GE+Fridge+Front",
      "https://placehold.co/800x600?text=GE+Fridge+Interior",
    ],
  },
  {
    name: "Licuadora Ninja 1000W",
    description: "Licuadora potente para smoothies y preparación diaria.",
    category: "Small Appliances",
    tags: ["small-appliances", "blender", "ninja"],
    sku: "NF-NINJA-BLENDER",
    base_price_cents: 12900,
    base_stock: 22,
    images: [
      "https://placehold.co/800x600?text=Ninja+Blender+Front",
      "https://placehold.co/800x600?text=Ninja+Blender+Cup",
    ],
  },
  {
    name: "Aspiradora Dyson V-series",
    description: "Aspiradora inalámbrica con gran potencia de succión.",
    category: "Cleaning",
    tags: ["cleaning", "vacuum", "dyson"],
    sku: "NF-DYSON-VSERIES",
    variants: [
      { variant_name: "V8", attributes: { model: "V8" }, price_cents: 37900, stock: 11, sku: "NF-DYSON-V8" },
      { variant_name: "V10", attributes: { model: "V10" }, price_cents: 49900, stock: 7, sku: "NF-DYSON-V10" },
    ],
    images: [
      "https://placehold.co/800x600?text=Dyson+V-Series+Body",
      "https://placehold.co/800x600?text=Dyson+V-Series+Accessories",
    ],
  },
  {
    name: "Aire acondicionado Hisense",
    description: "Mini-split inverter con ahorro energético.",
    category: "Climate",
    tags: ["climate", "ac", "hisense"],
    sku: "NF-HISENSE-AC",
    variants: [
      { variant_name: "12k BTU", attributes: { btu: "12000" }, price_cents: 45900, stock: 10, sku: "NF-HISENSE-AC-12K" },
      { variant_name: "18k BTU", attributes: { btu: "18000" }, price_cents: 59900, stock: 8, sku: "NF-HISENSE-AC-18K" },
    ],
    images: [
      "https://placehold.co/800x600?text=Hisense+AC+Indoor+Unit",
      "https://placehold.co/800x600?text=Hisense+AC+Remote",
    ],
  },
  {
    name: "Lavavajillas Bosch",
    description: "Lavavajillas eficiente con múltiples ciclos de lavado.",
    category: "Kitchen",
    tags: ["kitchen", "dishwasher", "bosch"],
    sku: "NF-BOSCH-DISHWASHER",
    base_price_cents: 69900,
    base_stock: 7,
    images: [
      "https://placehold.co/800x600?text=Bosch+Dishwasher+Front",
      "https://placehold.co/800x600?text=Bosch+Dishwasher+Racks",
    ],
  },
  {
    name: "Cafetera Keurig",
    description: "Cafetera de cápsulas para preparación rápida.",
    category: "Small Appliances",
    tags: ["small-appliances", "coffee", "keurig"],
    sku: "NF-KEURIG-COFFEE",
    base_price_cents: 9900,
    base_stock: 25,
    images: [
      "https://placehold.co/800x600?text=Keurig+Coffee+Machine",
      "https://placehold.co/800x600?text=Keurig+Pods",
    ],
  },
  {
    name: "Robot aspirador iRobot",
    description: "Robot aspirador inteligente con mapeo automático.",
    category: "Cleaning",
    tags: ["cleaning", "robot", "irobot"],
    sku: "NF-IROBOT-ROOMBA",
    base_price_cents: 32900,
    base_stock: 14,
    images: [
      "https://placehold.co/800x600?text=iRobot+Roomba+Top",
      "https://placehold.co/800x600?text=iRobot+Roomba+Dock",
    ],
  },
];

async function ensureDevOwnerUser() {
  const email = "julio123@example.com";
  const password = "Julio123";

  const createResult = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: "JULIO123" },
  });

  let userId = createResult.data.user?.id;

  if (!userId) {
    let page = 1;
    while (page < 20 && !userId) {
      const { data } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
      const found = data.users.find((user) => user.email?.toLowerCase() === email);
      if (found) userId = found.id;
      if (data.users.length < 100) break;
      page += 1;
    }
  }

  if (!userId) {
    throw new Error(createResult.error?.message ?? "Unable to create or find DEV user");
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: userId,
    role: "owner",
    username: "JULIO123",
  });

  if (profileError) {
    throw profileError;
  }

  return { email, userId };
}

async function run() {
  await supabase.from("categories").upsert(categories, { onConflict: "slug" });

  const { data: categoryRows, error: categoriesError } = await supabase.from("categories").select("id,name");
  if (categoriesError || !categoryRows) throw categoriesError ?? new Error("Cannot fetch categories");

  const categoryByName = Object.fromEntries(categoryRows.map((c) => [c.name, c.id])) as Record<string, string>;

  const productRows = products.map((product) => ({
    name: product.name,
    description: product.description,
    category_id: categoryByName[product.category],
    tags: product.tags,
    sku: product.sku,
    active: true,
    featured: Boolean(product.featured),
    featured_rank: product.featured ?? 0,
    has_variants: Boolean(product.variants?.length),
    base_price_cents: product.variants?.length ? null : product.base_price_cents ?? null,
    base_stock: product.variants?.length ? 0 : product.base_stock ?? 0,
  }));

  const { data: insertedProducts, error: productsError } = await supabase
    .from("products")
    .upsert(productRows, { onConflict: "sku" })
    .select("id,sku,name,has_variants");

  if (productsError || !insertedProducts) throw productsError ?? new Error("Cannot upsert products");

  const productBySku = Object.fromEntries(insertedProducts.map((p) => [p.sku, p]));

  for (const product of products) {
    const inserted = productBySku[product.sku];
    if (!inserted) continue;

    await supabase.from("product_images").delete().eq("product_id", inserted.id);
    await supabase.from("product_images").insert([
      { product_id: inserted.id, url: product.images[0], sort_order: 0 },
      { product_id: inserted.id, url: product.images[1], sort_order: 1 },
    ]);

    if (product.variants?.length) {
      await supabase.from("product_variants").upsert(
        product.variants.map((variant) => ({ ...variant, product_id: inserted.id })),
        { onConflict: "sku" },
      );
    } else {
      await supabase.from("product_variants").delete().eq("product_id", inserted.id);
    }
  }

  const dev = await ensureDevOwnerUser();
  console.log(`Seed complete. DEV owner: ${dev.email} (${dev.userId})`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
