-- Sprint 8 base: catalogo publico somente com produtos ativos e campos seguros

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS promotional_price NUMERIC(12, 2)
CHECK (promotional_price IS NULL OR promotional_price >= 0);

CREATE OR REPLACE FUNCTION public.list_public_catalog_products(
  company_slug TEXT DEFAULT 'delicias-da-marli'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  description TEXT,
  sale_price NUMERIC,
  promotional_price NUMERIC,
  image_url TEXT
) AS $$
  SELECT
    product.id,
    product.name,
    product.category,
    product.description,
    product.sale_price,
    product.promotional_price,
    product.image_url
  FROM public.products product
  JOIN public.companies company
    ON company.id = product.company_id
  WHERE product.is_active = true
    AND company.slug = company_slug
  ORDER BY product.created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.list_public_catalog_products(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.list_public_catalog_products(TEXT) TO authenticated;
