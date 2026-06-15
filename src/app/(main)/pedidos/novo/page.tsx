import { getOrderFormOptions } from '@/actions/orders'
import { OrderForm } from '@/components/orders/order-form'

export default async function NewOrderPage() {
  const { customers, products } = await getOrderFormOptions()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo pedido</h1>
        <p className="text-sm text-muted-foreground">
          Monte o pedido com cliente, produtos, desconto e forma de pagamento.
        </p>
      </div>

      <OrderForm customers={customers} products={products} />
    </div>
  )
}
