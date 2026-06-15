-- Sprint 3: product recipe metrics
-- Safe migration for databases created from the Sprint 0/2 schema.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'cmv'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'cmv_percent'
  ) THEN
    ALTER TABLE public.products RENAME COLUMN cmv TO cmv_percent;
  END IF;
END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cmv_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'cmv'
  ) THEN
    EXECUTE '
      UPDATE public.products
      SET cmv_percent = COALESCE(NULLIF(cmv_percent, 0), cmv, 0)
    ';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_company_active
  ON public.products(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient_id
  ON public.recipe_items(ingredient_id);
