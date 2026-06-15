-- Sprint 12: hardening transacional de compras, estoque e pedidos.

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
  recipe_id UUID;
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
    INTO recipe_id
    FROM public.recipes recipe
    WHERE recipe.product_id = order_item.product_id
      AND recipe.company_id = p_company_id;

    IF recipe_id IS NULL THEN
      RAISE EXCEPTION 'Produto sem ficha técnica: %.', order_item.product_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.recipe_items item
      WHERE item.recipe_id = recipe_id
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
      WHERE item.recipe_id = recipe_id
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
