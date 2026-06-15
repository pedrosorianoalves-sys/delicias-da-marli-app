-- Sprint 4B: Pedidos/Vendas
-- Ajustes seguros para cálculo de CMV, baixa de estoque e pagamento manual.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cmv_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_estimated_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_estimated_cost NUMERIC(12, 4) NOT NULL DEFAULT 0;

UPDATE public.orders
SET payment_method = 'pix_manual'
WHERE payment_method = 'pix';

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%payment_method%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('pix_manual', 'dinheiro', 'cartao', 'outro'));

CREATE INDEX IF NOT EXISTS idx_orders_company_status_date
  ON public.orders(company_id, status, order_date);

CREATE INDEX IF NOT EXISTS idx_orders_payment_method
  ON public.orders(payment_method);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON public.order_items(product_id);
