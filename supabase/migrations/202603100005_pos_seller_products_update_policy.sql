-- Allow seller/admin POS flow to decrement product stock without service-role dependency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'seller_products_update_stock'
  ) THEN
    CREATE POLICY seller_products_update_stock
      ON public.products
      FOR UPDATE
      USING (is_seller())
      WITH CHECK (is_seller());
  END IF;
END
$$;

notify pgrst, 'reload schema';
