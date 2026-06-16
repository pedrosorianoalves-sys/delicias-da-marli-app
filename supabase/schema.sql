-- ============================================================
-- DELÍCIAS DA MARLI — Schema SQL Completo
-- Multi-tenant architecture com company_id em todas as tabelas
-- ============================================================

-- ============================================================
-- 1. TABELAS CORE (Auth & Multi-tenant)
-- ============================================================

-- Perfil do usuário (1:1 com auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  account_type TEXT CHECK (account_type IN ('business_owner', 'customer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Empresas
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vínculo usuário ↔ empresa
CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('owner', 'admin', 'operator', 'customer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- ============================================================
-- 2. TABELAS DE NEGÓCIO
-- ============================================================

-- Clientes
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  total_spent NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ingredientes
CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('g', 'kg', 'ml', 'l', 'unidade')),
  current_stock NUMERIC(12, 4) NOT NULL DEFAULT 0,
  average_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  min_stock NUMERIC(12, 4) NOT NULL DEFAULT 0,
  supplier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compras de ingredientes
CREATE TABLE public.ingredient_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12, 4) NOT NULL CHECK (unit_cost >= 0),
  total_cost NUMERIC(12, 4) NOT NULL CHECK (total_cost >= 0),
  supplier TEXT,
  notes TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Produtos
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  sale_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  promotional_price NUMERIC(12, 2) CHECK (promotional_price IS NULL OR promotional_price >= 0),
  image_url TEXT,
  estimated_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  gross_margin NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cmv_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Receitas (1:1 com produto)
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  yield_quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

-- Itens da receita
CREATE TABLE public.recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'kg', 'ml', 'l', 'unidade')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pedidos
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'entregue', 'cancelado')),
  payment_method TEXT CHECK (payment_method IN ('pix_manual', 'dinheiro', 'cartao', 'outro')),
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  estimated_profit NUMERIC(12, 4) NOT NULL DEFAULT 0,
  cmv_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  stock_deducted BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens do pedido
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_estimated_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_estimated_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Movimentações de estoque
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  quantity NUMERIC(12, 4) NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('purchase', 'order', 'manual')),
  reference_id UUID,
  cost_at_time NUMERIC(12, 4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configurações
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, key)
);

-- ============================================================
-- 3. ÍNDICES
-- ============================================================

CREATE INDEX idx_company_members_user_id ON public.company_members(user_id);
CREATE INDEX idx_company_members_company_id ON public.company_members(company_id);
CREATE INDEX idx_customers_company_id ON public.customers(company_id);
CREATE INDEX idx_ingredients_company_id ON public.ingredients(company_id);
CREATE INDEX idx_ingredient_purchases_company_id ON public.ingredient_purchases(company_id);
CREATE INDEX idx_ingredient_purchases_ingredient_id ON public.ingredient_purchases(ingredient_id);
CREATE INDEX idx_products_company_id ON public.products(company_id);
CREATE INDEX idx_products_company_active ON public.products(company_id, is_active);
CREATE INDEX idx_recipes_company_id ON public.recipes(company_id);
CREATE INDEX idx_recipes_product_id ON public.recipes(product_id);
CREATE INDEX idx_recipe_items_company_id ON public.recipe_items(company_id);
CREATE INDEX idx_recipe_items_recipe_id ON public.recipe_items(recipe_id);
CREATE INDEX idx_recipe_items_ingredient_id ON public.recipe_items(ingredient_id);
CREATE INDEX idx_orders_company_id ON public.orders(company_id);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_order_date ON public.orders(order_date);
CREATE INDEX idx_orders_company_status_date ON public.orders(company_id, status, order_date);
CREATE INDEX idx_orders_payment_method ON public.orders(payment_method);
CREATE INDEX idx_order_items_company_id ON public.order_items(company_id);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX idx_stock_movements_company_id ON public.stock_movements(company_id);
CREATE INDEX idx_stock_movements_ingredient_id ON public.stock_movements(ingredient_id);
CREATE INDEX idx_stock_movements_reference ON public.stock_movements(reference_type, reference_id);
CREATE INDEX idx_settings_company_id ON public.settings(company_id);

-- ============================================================
-- 4. FUNÇÕES AUXILIARES (SECURITY DEFINER)
-- ============================================================

-- Verifica se o usuário é membro de uma company
CREATE OR REPLACE FUNCTION public.is_company_member(_company_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = _company_id
    AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Retorna todos os company_ids do usuário
CREATE OR REPLACE FUNCTION public.get_my_company_ids()
RETURNS SETOF UUID AS $$
  SELECT company_id
  FROM public.company_members
  WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Retorna o role do usuário em uma company
CREATE OR REPLACE FUNCTION public.get_my_role_in_company(_company_id UUID)
RETURNS TEXT AS $$
  SELECT role
  FROM public.company_members
  WHERE company_id = _company_id
  AND user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Verifica se o usuário possui um dos roles informados na company
CREATE OR REPLACE FUNCTION public.has_company_role(_company_id UUID, _roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = _company_id
    AND user_id = auth.uid()
    AND role = ANY(_roles)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Retorna company_ids operacionais do usuário
CREATE OR REPLACE FUNCTION public.get_my_operational_company_ids()
RETURNS SETOF UUID AS $$
  SELECT company_id
  FROM public.company_members
  WHERE user_id = auth.uid()
  AND role IN ('owner', 'admin', 'operator');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 5. TRIGGER: Auto-onboarding seguro (cria apenas profile)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, account_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    'customer'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    account_type = COALESCE(public.profiles.account_type, 'customer'),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.list_unassigned_customer_profiles()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  account_type TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para listar usuários disponíveis.';
  END IF;

  RETURN QUERY
  SELECT
    profile.id,
    profile.full_name,
    profile.email,
    profile.account_type,
    profile.created_at
  FROM public.profiles profile
  WHERE COALESCE(profile.account_type, 'customer') = 'customer'
    AND NOT EXISTS (
      SELECT 1
      FROM public.company_members member
      WHERE member.user_id = profile.id
    )
  ORDER BY profile.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.list_unassigned_customer_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.promote_customer_to_company(
  target_user_id UUID,
  target_company_id UUID,
  target_role TEXT
)
RETURNS TABLE (member_id UUID) AS $$
DECLARE
  new_member_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF target_role NOT IN ('owner', 'admin', 'operator') THEN
    RAISE EXCEPTION 'Role inválido para promoção.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = target_company_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Apenas owner pode promover usuários.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = target_user_id
      AND COALESCE(account_type, 'customer') = 'customer'
  ) THEN
    RAISE EXCEPTION 'Usuário customer não encontrado.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'Usuário já possui vínculo com uma empresa.';
  END IF;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (target_company_id, target_user_id, target_role)
  RETURNING id INTO new_member_id;

  UPDATE public.profiles
  SET account_type = 'business_owner',
      updated_at = now()
  WHERE id = target_user_id;

  RETURN QUERY SELECT new_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.promote_customer_to_company(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_company_member_profile_name(
  target_user_id UUID,
  target_company_id UUID,
  target_full_name TEXT
)
RETURNS VOID AS $$
DECLARE
  safe_full_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  safe_full_name := NULLIF(trim(target_full_name), '');

  IF safe_full_name IS NULL THEN
    RAISE EXCEPTION 'Nome é obrigatório.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = target_company_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Apenas owner pode editar nomes da equipe.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = target_company_id
      AND user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence a esta empresa.';
  END IF;

  UPDATE public.profiles
  SET full_name = safe_full_name,
      updated_at = now()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.update_company_member_profile_name(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_company_members_with_profiles(
  target_company_id UUID
)
RETURNS TABLE (
  member_id UUID,
  company_id UUID,
  user_id UUID,
  role TEXT,
  member_created_at TIMESTAMPTZ,
  member_updated_at TIMESTAMPTZ,
  full_name TEXT,
  email TEXT,
  account_type TEXT
) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members current_member
    WHERE current_member.company_id = target_company_id
      AND current_member.user_id = auth.uid()
      AND current_member.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para listar membros desta empresa.';
  END IF;

  RETURN QUERY
  SELECT
    member.id,
    member.company_id,
    member.user_id,
    member.role,
    member.created_at,
    member.updated_at,
    profile.full_name,
    profile.email,
    profile.account_type
  FROM public.company_members member
  LEFT JOIN public.profiles profile
    ON profile.id = member.user_id
  WHERE member.company_id = target_company_id
  ORDER BY member.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.list_company_members_with_profiles(UUID) TO authenticated;

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

-- ============================================================
-- 6. TRIGGER: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em todas as tabelas
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ingredient_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.recipe_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 7. RLS (Row Level Security)
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS: profiles
-- ============================================================

CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "profiles_select_company_admin"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.company_members target_member
    JOIN public.company_members current_member
      ON current_member.company_id = target_member.company_id
    WHERE target_member.user_id = profiles.id
    AND current_member.user_id = auth.uid()
    AND current_member.role IN ('owner', 'admin')
  )
);

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- ============================================================
-- RLS: companies
-- ============================================================

CREATE POLICY "companies_select_member"
ON public.companies FOR SELECT TO authenticated
USING ((SELECT public.is_company_member(id)));

CREATE POLICY "companies_update_admin"
ON public.companies FOR UPDATE TO authenticated
USING ((SELECT public.get_my_role_in_company(id)) IN ('owner', 'admin'))
WITH CHECK ((SELECT public.get_my_role_in_company(id)) IN ('owner', 'admin'));

CREATE POLICY "companies_insert_authenticated"
ON public.companies FOR INSERT TO authenticated
WITH CHECK (true);

-- ============================================================
-- RLS: company_members
-- ============================================================

CREATE POLICY "company_members_select"
ON public.company_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (SELECT public.has_company_role(company_id, ARRAY['owner', 'admin']))
);

CREATE POLICY "company_members_insert_owner"
ON public.company_members FOR INSERT TO authenticated
WITH CHECK ((SELECT public.has_company_role(company_id, ARRAY['owner'])));

CREATE POLICY "company_members_update_owner"
ON public.company_members FOR UPDATE TO authenticated
USING ((SELECT public.has_company_role(company_id, ARRAY['owner'])))
WITH CHECK ((SELECT public.has_company_role(company_id, ARRAY['owner'])));

CREATE POLICY "company_members_delete_owner"
ON public.company_members FOR DELETE TO authenticated
USING (
  (SELECT public.has_company_role(company_id, ARRAY['owner']))
  OR user_id = auth.uid()
);

-- ============================================================
-- RLS: PADRÃO TENANT para tabelas com company_id
-- ============================================================

-- customers
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

-- ingredients
CREATE POLICY "ingredients_select" ON public.ingredients FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "ingredients_insert" ON public.ingredients FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "ingredients_update" ON public.ingredients FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "ingredients_delete" ON public.ingredients FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

-- ingredient_purchases
CREATE POLICY "ingredient_purchases_select" ON public.ingredient_purchases FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "ingredient_purchases_insert" ON public.ingredient_purchases FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "ingredient_purchases_update" ON public.ingredient_purchases FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "ingredient_purchases_delete" ON public.ingredient_purchases FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

-- products
CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "products_insert" ON public.products FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "products_update" ON public.products FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "products_delete" ON public.products FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

-- recipes
CREATE POLICY "recipes_select" ON public.recipes FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "recipes_insert" ON public.recipes FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "recipes_update" ON public.recipes FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "recipes_delete" ON public.recipes FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

-- recipe_items
CREATE POLICY "recipe_items_select" ON public.recipe_items FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "recipe_items_insert" ON public.recipe_items FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "recipe_items_update" ON public.recipe_items FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "recipe_items_delete" ON public.recipe_items FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

-- orders
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

-- order_items
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

-- stock_movements
CREATE POLICY "stock_movements_select" ON public.stock_movements FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "stock_movements_insert" ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "stock_movements_update" ON public.stock_movements FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "stock_movements_delete" ON public.stock_movements FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

-- settings
CREATE POLICY "settings_select" ON public.settings FOR SELECT TO authenticated
USING ((SELECT public.has_company_role(company_id, ARRAY['owner', 'admin'])));
CREATE POLICY "settings_insert" ON public.settings FOR INSERT TO authenticated
WITH CHECK ((SELECT public.has_company_role(company_id, ARRAY['owner'])));
CREATE POLICY "settings_update" ON public.settings FOR UPDATE TO authenticated
USING ((SELECT public.has_company_role(company_id, ARRAY['owner'])))
WITH CHECK ((SELECT public.has_company_role(company_id, ARRAY['owner'])));
CREATE POLICY "settings_delete" ON public.settings FOR DELETE TO authenticated
USING ((SELECT public.has_company_role(company_id, ARRAY['owner'])));

-- ============================================================
-- 8. RPCS TRANSACIONAIS DE ESTOQUE, COMPRAS E PEDIDOS
-- ============================================================

CREATE OR REPLACE FUNCTION public._require_operational_company(
  p_company_id UUID
)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members member
    WHERE member.company_id = p_company_id
      AND member.user_id = auth.uid()
      AND member.role IN ('owner', 'admin', 'operator')
  ) THEN
    RAISE EXCEPTION 'Permissão negada.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public._calculate_weighted_stock_cost(
  p_current_stock NUMERIC,
  p_current_average_cost NUMERIC,
  p_stock_delta NUMERIC,
  p_cost_delta NUMERIC
)
RETURNS TABLE (
  new_stock NUMERIC,
  new_average_cost NUMERIC
) AS $$
DECLARE
  safe_current_stock NUMERIC;
  safe_current_average_cost NUMERIC;
  next_stock NUMERIC;
  next_total_value NUMERIC;
BEGIN
  safe_current_stock := COALESCE(p_current_stock, 0);
  safe_current_average_cost := COALESCE(p_current_average_cost, 0);
  next_stock := ROUND(safe_current_stock + p_stock_delta, 4);

  IF next_stock < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente.';
  END IF;

  IF next_stock = 0 THEN
    new_stock := 0;
    new_average_cost := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  next_total_value := (safe_current_stock * safe_current_average_cost) + p_cost_delta;

  new_stock := next_stock;
  new_average_cost := ROUND(GREATEST(0, next_total_value / next_stock), 6);
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public._convert_to_ingredient_unit(
  p_quantity NUMERIC,
  p_source_unit TEXT,
  p_ingredient_unit TEXT
)
RETURNS NUMERIC AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida.';
  END IF;

  IF p_source_unit = p_ingredient_unit THEN
    RETURN p_quantity;
  END IF;

  IF p_ingredient_unit = 'kg' AND p_source_unit = 'g' THEN
    RETURN p_quantity / 1000;
  END IF;

  IF p_ingredient_unit = 'g' AND p_source_unit = 'kg' THEN
    RETURN p_quantity * 1000;
  END IF;

  IF p_ingredient_unit = 'l' AND p_source_unit = 'ml' THEN
    RETURN p_quantity / 1000;
  END IF;

  IF p_ingredient_unit = 'ml' AND p_source_unit = 'l' THEN
    RETURN p_quantity * 1000;
  END IF;

  RAISE EXCEPTION 'Unidade da receita incompatível com a unidade do ingrediente.';
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.create_ingredient_purchase_transactional(
  p_company_id UUID,
  p_ingredient_id UUID,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_supplier TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_purchased_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  purchase_id UUID,
  current_stock NUMERIC,
  average_cost NUMERIC
) AS $$
DECLARE
  ingredient_row RECORD;
  total_cost NUMERIC;
  calculated_stock NUMERIC;
  calculated_average_cost NUMERIC;
  created_purchase_id UUID;
BEGIN
  PERFORM public._require_operational_company(p_company_id);

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.';
  END IF;

  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Custo unitário deve ser maior ou igual a zero.';
  END IF;

  SELECT *
  INTO ingredient_row
  FROM public.ingredients
  WHERE id = p_ingredient_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingrediente inexistente.';
  END IF;

  total_cost := ROUND(p_quantity * p_unit_cost, 4);

  SELECT calc.new_stock, calc.new_average_cost
  INTO calculated_stock, calculated_average_cost
  FROM public._calculate_weighted_stock_cost(
    ingredient_row.current_stock,
    ingredient_row.average_cost,
    p_quantity,
    total_cost
  ) AS calc;

  INSERT INTO public.ingredient_purchases (
    company_id,
    ingredient_id,
    quantity,
    unit_cost,
    total_cost,
    supplier,
    notes,
    purchased_at
  )
  VALUES (
    p_company_id,
    p_ingredient_id,
    p_quantity,
    p_unit_cost,
    total_cost,
    NULLIF(trim(p_supplier), ''),
    NULLIF(trim(p_notes), ''),
    COALESCE(p_purchased_at, now())
  )
  RETURNING id INTO created_purchase_id;

  UPDATE public.ingredients
  SET current_stock = calculated_stock,
      average_cost = calculated_average_cost,
      updated_at = now()
  WHERE id = p_ingredient_id
    AND company_id = p_company_id;

  INSERT INTO public.stock_movements (
    company_id,
    ingredient_id,
    type,
    quantity,
    reference_type,
    reference_id,
    cost_at_time,
    notes
  )
  VALUES (
    p_company_id,
    p_ingredient_id,
    'in',
    p_quantity,
    'purchase',
    created_purchase_id,
    p_unit_cost,
    COALESCE(NULLIF(trim(p_notes), ''), 'Compra registrada')
  );

  purchase_id := created_purchase_id;
  current_stock := calculated_stock;
  average_cost := calculated_average_cost;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_ingredient_purchase_transactional(
  p_company_id UUID,
  p_purchase_id UUID,
  p_ingredient_id UUID,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_supplier TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_purchased_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  purchase_id UUID
) AS $$
DECLARE
  purchase_row RECORD;
  old_ingredient RECORD;
  new_ingredient RECORD;
  new_total_cost NUMERIC;
  old_next_stock NUMERIC;
  old_next_average_cost NUMERIC;
  new_next_stock NUMERIC;
  new_next_average_cost NUMERIC;
BEGIN
  PERFORM public._require_operational_company(p_company_id);

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.';
  END IF;

  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Custo unitário deve ser maior ou igual a zero.';
  END IF;

  SELECT *
  INTO purchase_row
  FROM public.ingredient_purchases
  WHERE id = p_purchase_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra não encontrada.';
  END IF;

  PERFORM 1
  FROM public.ingredients ingredient
  WHERE ingredient.company_id = p_company_id
    AND ingredient.id IN (purchase_row.ingredient_id, p_ingredient_id)
  ORDER BY ingredient.id
  FOR UPDATE;

  SELECT *
  INTO old_ingredient
  FROM public.ingredients
  WHERE id = purchase_row.ingredient_id
    AND company_id = p_company_id;

  SELECT *
  INTO new_ingredient
  FROM public.ingredients
  WHERE id = p_ingredient_id
    AND company_id = p_company_id;

  IF old_ingredient.id IS NULL OR new_ingredient.id IS NULL THEN
    RAISE EXCEPTION 'Ingrediente inexistente.';
  END IF;

  IF old_ingredient.current_stock - purchase_row.quantity < 0 THEN
    RAISE EXCEPTION 'Não é possível editar. O estoque ficaria negativo.';
  END IF;

  new_total_cost := ROUND(p_quantity * p_unit_cost, 4);

  SELECT calc.new_stock, calc.new_average_cost
  INTO old_next_stock, old_next_average_cost
  FROM public._calculate_weighted_stock_cost(
    old_ingredient.current_stock,
    old_ingredient.average_cost,
    -purchase_row.quantity,
    -purchase_row.total_cost
  ) AS calc;

  IF purchase_row.ingredient_id = p_ingredient_id THEN
    SELECT calc.new_stock, calc.new_average_cost
    INTO new_next_stock, new_next_average_cost
    FROM public._calculate_weighted_stock_cost(
      old_next_stock,
      old_next_average_cost,
      p_quantity,
      new_total_cost
    ) AS calc;

    UPDATE public.ingredients
    SET current_stock = new_next_stock,
        average_cost = new_next_average_cost,
        updated_at = now()
    WHERE id = p_ingredient_id
      AND company_id = p_company_id;
  ELSE
    SELECT calc.new_stock, calc.new_average_cost
    INTO new_next_stock, new_next_average_cost
    FROM public._calculate_weighted_stock_cost(
      new_ingredient.current_stock,
      new_ingredient.average_cost,
      p_quantity,
      new_total_cost
    ) AS calc;

    UPDATE public.ingredients
    SET current_stock = old_next_stock,
        average_cost = old_next_average_cost,
        updated_at = now()
    WHERE id = old_ingredient.id
      AND company_id = p_company_id;

    UPDATE public.ingredients
    SET current_stock = new_next_stock,
        average_cost = new_next_average_cost,
        updated_at = now()
    WHERE id = new_ingredient.id
      AND company_id = p_company_id;
  END IF;

  UPDATE public.ingredient_purchases
  SET ingredient_id = p_ingredient_id,
      quantity = p_quantity,
      unit_cost = p_unit_cost,
      total_cost = new_total_cost,
      supplier = NULLIF(trim(p_supplier), ''),
      notes = NULLIF(trim(p_notes), ''),
      purchased_at = COALESCE(p_purchased_at, now()),
      updated_at = now()
  WHERE id = p_purchase_id
    AND company_id = p_company_id;

  DELETE FROM public.stock_movements
  WHERE company_id = p_company_id
    AND reference_type = 'purchase'
    AND reference_id = p_purchase_id;

  INSERT INTO public.stock_movements (
    company_id,
    ingredient_id,
    type,
    quantity,
    reference_type,
    reference_id,
    cost_at_time,
    notes
  )
  VALUES (
    p_company_id,
    p_ingredient_id,
    'in',
    p_quantity,
    'purchase',
    p_purchase_id,
    p_unit_cost,
    COALESCE(NULLIF(trim(p_notes), ''), 'Compra registrada')
  );

  purchase_id := p_purchase_id;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.delete_ingredient_purchase_transactional(
  p_company_id UUID,
  p_purchase_id UUID
)
RETURNS VOID AS $$
DECLARE
  purchase_row RECORD;
  ingredient_row RECORD;
  calculated_stock NUMERIC;
  calculated_average_cost NUMERIC;
BEGIN
  PERFORM public._require_operational_company(p_company_id);

  SELECT *
  INTO purchase_row
  FROM public.ingredient_purchases
  WHERE id = p_purchase_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra não encontrada.';
  END IF;

  SELECT *
  INTO ingredient_row
  FROM public.ingredients
  WHERE id = purchase_row.ingredient_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingrediente inexistente.';
  END IF;

  IF ingredient_row.current_stock - purchase_row.quantity < 0 THEN
    RAISE EXCEPTION 'Não é possível excluir. O estoque ficaria negativo.';
  END IF;

  SELECT calc.new_stock, calc.new_average_cost
  INTO calculated_stock, calculated_average_cost
  FROM public._calculate_weighted_stock_cost(
    ingredient_row.current_stock,
    ingredient_row.average_cost,
    -purchase_row.quantity,
    -purchase_row.total_cost
  ) AS calc;

  UPDATE public.ingredients
  SET current_stock = calculated_stock,
      average_cost = calculated_average_cost,
      updated_at = now()
  WHERE id = ingredient_row.id
    AND company_id = p_company_id;

  INSERT INTO public.stock_movements (
    company_id,
    ingredient_id,
    type,
    quantity,
    reference_type,
    reference_id,
    cost_at_time,
    notes
  )
  VALUES (
    p_company_id,
    purchase_row.ingredient_id,
    'adjustment',
    -purchase_row.quantity,
    'purchase',
    purchase_row.id,
    purchase_row.unit_cost,
    'Reversão da exclusão da compra'
  );

  DELETE FROM public.ingredient_purchases
  WHERE id = p_purchase_id
    AND company_id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.mark_order_paid_transactional(
  p_company_id UUID,
  p_order_id UUID
)
RETURNS VOID AS $$
DECLARE
  order_row RECORD;
  order_item RECORD;
  v_recipe_id UUID;
  recipe_item RECORD;
  required_by_ingredient JSONB := '{}'::jsonb;
  converted_quantity NUMERIC;
  required_quantity NUMERIC;
  existing_required_quantity NUMERIC;
  required_item RECORD;
  ingredient_row RECORD;
  customer_row RECORD;
BEGIN
  PERFORM public._require_operational_company(p_company_id);

  SELECT *
  INTO order_row
  FROM public.orders
  WHERE id = p_order_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF order_row.status = 'cancelado' THEN
    RAISE EXCEPTION 'Pedido cancelado não pode ser marcado como pago.';
  END IF;

  IF order_row.status = 'entregue' THEN
    RAISE EXCEPTION 'Pedido entregue já foi finalizado.';
  END IF;

  IF order_row.status = 'pago' THEN
    RAISE EXCEPTION 'Pedido já está pago.';
  END IF;

  IF order_row.stock_deducted THEN
    RAISE EXCEPTION 'Estoque deste pedido já foi baixado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_items item
    WHERE item.order_id = p_order_id
      AND item.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Pedido sem produtos.';
  END IF;

  FOR order_item IN
    SELECT
      item.product_id,
      item.quantity,
      product.name AS product_name
    FROM public.order_items item
    JOIN public.products product
      ON product.id = item.product_id
     AND product.company_id = p_company_id
    WHERE item.order_id = p_order_id
      AND item.company_id = p_company_id
    ORDER BY item.id
  LOOP
    SELECT recipe.id
    INTO v_recipe_id
    FROM public.recipes recipe
    WHERE recipe.product_id = order_item.product_id
      AND recipe.company_id = p_company_id;

    IF v_recipe_id IS NULL THEN
      RAISE EXCEPTION 'Produto sem ficha técnica: %.', order_item.product_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.recipe_items item
      WHERE item.recipe_id = v_recipe_id
        AND item.company_id = p_company_id
    ) THEN
      RAISE EXCEPTION 'Produto sem ficha técnica: %.', order_item.product_name;
    END IF;

    FOR recipe_item IN
      SELECT
        item.quantity,
        item.unit,
        ingredient.id AS ingredient_id,
        ingredient.name AS ingredient_name,
        ingredient.unit AS ingredient_unit
      FROM public.recipe_items item
      JOIN public.ingredients ingredient
        ON ingredient.id = item.ingredient_id
       AND ingredient.company_id = p_company_id
      WHERE item.recipe_id = v_recipe_id
        AND item.company_id = p_company_id
      ORDER BY ingredient.id
    LOOP
      converted_quantity := public._convert_to_ingredient_unit(
        recipe_item.quantity,
        recipe_item.unit,
        recipe_item.ingredient_unit
      );
      required_quantity := ROUND(converted_quantity * order_item.quantity, 4);
      existing_required_quantity := COALESCE(
        (required_by_ingredient ->> recipe_item.ingredient_id::text)::NUMERIC,
        0
      );
      required_by_ingredient := jsonb_set(
        required_by_ingredient,
        ARRAY[recipe_item.ingredient_id::text],
        to_jsonb(ROUND(existing_required_quantity + required_quantity, 4)),
        true
      );
    END LOOP;
  END LOOP;

  IF required_by_ingredient = '{}'::jsonb THEN
    RAISE EXCEPTION 'Pedido sem ingredientes para baixa de estoque.';
  END IF;

  FOR required_item IN
    SELECT key::UUID AS ingredient_id, value::NUMERIC AS quantity
    FROM jsonb_each_text(required_by_ingredient)
    ORDER BY key
  LOOP
    SELECT *
    INTO ingredient_row
    FROM public.ingredients
    WHERE id = required_item.ingredient_id
      AND company_id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ingrediente inexistente.';
    END IF;

    IF ingredient_row.current_stock < required_item.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para %.', ingredient_row.name;
    END IF;

    UPDATE public.ingredients
    SET current_stock = ROUND(ingredient_row.current_stock - required_item.quantity, 4),
        updated_at = now()
    WHERE id = ingredient_row.id
      AND company_id = p_company_id;

    INSERT INTO public.stock_movements (
      company_id,
      ingredient_id,
      type,
      quantity,
      reference_type,
      reference_id,
      cost_at_time,
      notes
    )
    VALUES (
      p_company_id,
      ingredient_row.id,
      'out',
      required_item.quantity,
      'order',
      p_order_id,
      ingredient_row.average_cost,
      'Baixa automática do pedido ' || left(p_order_id::text, 8)
    );
  END LOOP;

  UPDATE public.orders
  SET status = 'pago',
      stock_deducted = true,
      updated_at = now()
  WHERE id = p_order_id
    AND company_id = p_company_id;

  IF order_row.customer_id IS NOT NULL THEN
    SELECT *
    INTO customer_row
    FROM public.customers
    WHERE id = order_row.customer_id
      AND company_id = p_company_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.customers
      SET total_spent = ROUND(COALESCE(customer_row.total_spent, 0) + order_row.total, 2),
          total_orders = COALESCE(customer_row.total_orders, 0) + 1,
          last_order_at = order_row.order_date,
          updated_at = now()
      WHERE id = order_row.customer_id
        AND company_id = p_company_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.cancel_order_transactional(
  p_company_id UUID,
  p_order_id UUID
)
RETURNS VOID AS $$
DECLARE
  order_row RECORD;
  movement_row RECORD;
  ingredient_row RECORD;
  customer_row RECORD;
  last_order_at_value TIMESTAMPTZ;
  movement_count INTEGER;
BEGIN
  PERFORM public._require_operational_company(p_company_id);

  SELECT *
  INTO order_row
  FROM public.orders
  WHERE id = p_order_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF order_row.status = 'cancelado' THEN
    RAISE EXCEPTION 'Pedido já está cancelado.';
  END IF;

  IF order_row.stock_deducted THEN
    SELECT COUNT(*)
    INTO movement_count
    FROM public.stock_movements movement
    WHERE movement.company_id = p_company_id
      AND movement.reference_type = 'order'
      AND movement.reference_id = p_order_id
      AND movement.type = 'out';

    IF movement_count = 0 THEN
      RAISE EXCEPTION 'Movimentações de estoque do pedido não encontradas.';
    END IF;

    FOR movement_row IN
      SELECT *
      FROM public.stock_movements movement
      WHERE movement.company_id = p_company_id
        AND movement.reference_type = 'order'
        AND movement.reference_id = p_order_id
        AND movement.type = 'out'
      ORDER BY movement.ingredient_id, movement.id
    LOOP
      SELECT *
      INTO ingredient_row
      FROM public.ingredients
      WHERE id = movement_row.ingredient_id
        AND company_id = p_company_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Ingrediente da movimentação não encontrado.';
      END IF;

      UPDATE public.ingredients
      SET current_stock = ROUND(ingredient_row.current_stock + movement_row.quantity, 4),
          updated_at = now()
      WHERE id = ingredient_row.id
        AND company_id = p_company_id;

      INSERT INTO public.stock_movements (
        company_id,
        ingredient_id,
        type,
        quantity,
        reference_type,
        reference_id,
        cost_at_time,
        notes
      )
      VALUES (
        p_company_id,
        movement_row.ingredient_id,
        'adjustment',
        movement_row.quantity,
        'order',
        p_order_id,
        movement_row.cost_at_time,
        'Reversão do cancelamento do pedido ' || left(p_order_id::text, 8)
      );
    END LOOP;
  END IF;

  IF order_row.customer_id IS NOT NULL
     AND order_row.status IN ('pago', 'entregue') THEN
    SELECT *
    INTO customer_row
    FROM public.customers
    WHERE id = order_row.customer_id
      AND company_id = p_company_id
    FOR UPDATE;

    IF FOUND THEN
      SELECT MAX(other_order.order_date)
      INTO last_order_at_value
      FROM public.orders other_order
      WHERE other_order.company_id = p_company_id
        AND other_order.customer_id = order_row.customer_id
        AND other_order.id <> p_order_id
        AND other_order.status IN ('pago', 'entregue');

      UPDATE public.customers
      SET total_spent = ROUND(GREATEST(0, COALESCE(customer_row.total_spent, 0) - order_row.total), 2),
          total_orders = GREATEST(0, COALESCE(customer_row.total_orders, 0) - 1),
          last_order_at = last_order_at_value,
          updated_at = now()
      WHERE id = order_row.customer_id
        AND company_id = p_company_id;
    END IF;
  END IF;

  UPDATE public.orders
  SET status = 'cancelado',
      stock_deducted = false,
      updated_at = now()
  WHERE id = p_order_id
    AND company_id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public._require_operational_company(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._calculate_weighted_stock_cost(NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._convert_to_ingredient_unit(NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_ingredient_purchase_transactional(UUID, UUID, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_ingredient_purchase_transactional(UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_ingredient_purchase_transactional(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_order_paid_transactional(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_order_transactional(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_ingredient_purchase_transactional(UUID, UUID, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ingredient_purchase_transactional(UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_ingredient_purchase_transactional(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid_transactional(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_transactional(UUID, UUID) TO authenticated;
