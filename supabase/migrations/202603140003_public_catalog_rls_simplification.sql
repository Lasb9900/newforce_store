-- Simplify public read policies for storefront catalog to avoid recursive policy/function paths.

-- Products public read: only active products.
drop policy if exists products_public_select on public.products;
create policy products_public_select
on public.products
for select
using (coalesce(active, false) = true);

-- Categories public read: unrestricted read for storefront navigation.
drop policy if exists categories_public_select on public.categories;
create policy categories_public_select
on public.categories
for select
using (true);

-- Product images public read: unrestricted read to avoid policy recursion through products joins.
drop policy if exists images_public_select on public.product_images;
create policy images_public_select
on public.product_images
for select
using (true);

-- Variants public read: keep simple active visibility.
drop policy if exists variants_public_select on public.product_variants;
create policy variants_public_select
on public.product_variants
for select
using (coalesce(active, false) = true);
