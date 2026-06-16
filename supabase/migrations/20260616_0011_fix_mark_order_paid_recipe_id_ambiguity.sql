-- Fix ambiguous recipe_id reference inside mark_order_paid_transactional.

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

REVOKE ALL ON FUNCTION public.mark_order_paid_transactional(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_order_paid_transactional(UUID, UUID) TO authenticated;
