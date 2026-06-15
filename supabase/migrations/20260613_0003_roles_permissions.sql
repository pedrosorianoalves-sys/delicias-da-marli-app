-- Sprint 6: Roles, permissões e separação Admin/Cliente

UPDATE public.company_members
SET role = 'operator'
WHERE role = 'member';

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.company_members'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.company_members DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.company_members
  ADD CONSTRAINT company_members_role_check
  CHECK (role IN ('owner', 'admin', 'operator', 'customer'));

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

CREATE OR REPLACE FUNCTION public.get_my_operational_company_ids()
RETURNS SETOF UUID AS $$
  SELECT company_id
  FROM public.company_members
  WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'operator');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "company_members_select" ON public.company_members;
DROP POLICY IF EXISTS "company_members_insert_admin" ON public.company_members;
DROP POLICY IF EXISTS "company_members_delete_admin" ON public.company_members;
DROP POLICY IF EXISTS "company_members_update_owner" ON public.company_members;

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

DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customers_delete" ON public.customers;
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

DROP POLICY IF EXISTS "ingredients_select" ON public.ingredients;
DROP POLICY IF EXISTS "ingredients_insert" ON public.ingredients;
DROP POLICY IF EXISTS "ingredients_update" ON public.ingredients;
DROP POLICY IF EXISTS "ingredients_delete" ON public.ingredients;
CREATE POLICY "ingredients_select" ON public.ingredients FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "ingredients_insert" ON public.ingredients FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "ingredients_update" ON public.ingredients FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "ingredients_delete" ON public.ingredients FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

DROP POLICY IF EXISTS "ingredient_purchases_select" ON public.ingredient_purchases;
DROP POLICY IF EXISTS "ingredient_purchases_insert" ON public.ingredient_purchases;
DROP POLICY IF EXISTS "ingredient_purchases_update" ON public.ingredient_purchases;
DROP POLICY IF EXISTS "ingredient_purchases_delete" ON public.ingredient_purchases;
CREATE POLICY "ingredient_purchases_select" ON public.ingredient_purchases FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "ingredient_purchases_insert" ON public.ingredient_purchases FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "ingredient_purchases_update" ON public.ingredient_purchases FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "ingredient_purchases_delete" ON public.ingredient_purchases FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_insert" ON public.products;
DROP POLICY IF EXISTS "products_update" ON public.products;
DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "products_insert" ON public.products FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "products_update" ON public.products FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "products_delete" ON public.products FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

DROP POLICY IF EXISTS "recipes_select" ON public.recipes;
DROP POLICY IF EXISTS "recipes_insert" ON public.recipes;
DROP POLICY IF EXISTS "recipes_update" ON public.recipes;
DROP POLICY IF EXISTS "recipes_delete" ON public.recipes;
CREATE POLICY "recipes_select" ON public.recipes FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "recipes_insert" ON public.recipes FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "recipes_update" ON public.recipes FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "recipes_delete" ON public.recipes FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

DROP POLICY IF EXISTS "recipe_items_select" ON public.recipe_items;
DROP POLICY IF EXISTS "recipe_items_insert" ON public.recipe_items;
DROP POLICY IF EXISTS "recipe_items_update" ON public.recipe_items;
DROP POLICY IF EXISTS "recipe_items_delete" ON public.recipe_items;
CREATE POLICY "recipe_items_select" ON public.recipe_items FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "recipe_items_insert" ON public.recipe_items FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "recipe_items_update" ON public.recipe_items FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "recipe_items_delete" ON public.recipe_items FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_delete" ON public.orders;
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

DROP POLICY IF EXISTS "stock_movements_select" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_update" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_delete" ON public.stock_movements;
CREATE POLICY "stock_movements_select" ON public.stock_movements FOR SELECT TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "stock_movements_insert" ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "stock_movements_update" ON public.stock_movements FOR UPDATE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()))
WITH CHECK (company_id IN (SELECT public.get_my_operational_company_ids()));
CREATE POLICY "stock_movements_delete" ON public.stock_movements FOR DELETE TO authenticated
USING (company_id IN (SELECT public.get_my_operational_company_ids()));

DROP POLICY IF EXISTS "settings_select" ON public.settings;
DROP POLICY IF EXISTS "settings_insert" ON public.settings;
DROP POLICY IF EXISTS "settings_update" ON public.settings;
DROP POLICY IF EXISTS "settings_delete" ON public.settings;
CREATE POLICY "settings_select" ON public.settings FOR SELECT TO authenticated
USING ((SELECT public.has_company_role(company_id, ARRAY['owner', 'admin'])));
CREATE POLICY "settings_insert" ON public.settings FOR INSERT TO authenticated
WITH CHECK ((SELECT public.has_company_role(company_id, ARRAY['owner'])));
CREATE POLICY "settings_update" ON public.settings FOR UPDATE TO authenticated
USING ((SELECT public.has_company_role(company_id, ARRAY['owner'])))
WITH CHECK ((SELECT public.has_company_role(company_id, ARRAY['owner'])));
CREATE POLICY "settings_delete" ON public.settings FOR DELETE TO authenticated
USING ((SELECT public.has_company_role(company_id, ARRAY['owner'])));
