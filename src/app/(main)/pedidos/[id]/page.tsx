import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getOrder, getOrderFormOptions } from '@/actions/orders'
import { OrderDetail } from '@/components/orders/order-detail'
import { OrderForm } from '@/components/orders/order-form'
import { Button } from '@/components/ui/button'

interface OrderPageProps {
  params: Promise<{ id: string }>
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { id } = await params
  const order = await getOrder(id)

  if (!order) notFound()

  const options =
    order.status === 'pendente' ? await getOrderFormOptions() : null
  const products = options
    ? [
        ...options.products,
        ...order.order_items
          .map((item) => item.product)
          .filter(
            (product) =>
              !options.products.some((option) => option.id === product.id),
          ),
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" render={<Link href="/pedidos" />}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            Pedido #{order.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Veja os totais, itens, status e movimentações deste pedido.
          </p>
        </div>
      </div>

      <OrderDetail order={order} />

      {options && (
        <div className="space-y-3 border-t pt-6">
          <div>
            <h2 className="text-xl font-semibold">Editar pedido pendente</h2>
            <p className="text-sm text-muted-foreground">
              A edição fica disponível somente antes do pagamento, entrega ou cancelamento.
            </p>
          </div>
          <OrderForm
            customers={options.customers}
            products={products}
            order={order}
          />
        </div>
      )}
    </div>
  )
}
