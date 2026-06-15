import Link from 'next/link'
import { Plus } from 'lucide-react'

import { getOrders } from '@/actions/orders'
import { ExportButtons } from '@/components/export/export-buttons'
import { OrderTable } from '@/components/orders/order-table'
import { Button } from '@/components/ui/button'
import { ordersExportSections } from '@/lib/export-sections'

export default async function OrdersPage() {
  const orders = await getOrders()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe vendas, pagamento, entrega e baixa de estoque.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ExportButtons
            title="Pedidos"
            sections={ordersExportSections(orders)}
          />
          <Button render={<Link href="/pedidos/novo" />}>
            <Plus className="size-4" />
            Novo pedido
          </Button>
        </div>
      </div>

      <OrderTable orders={orders} />
    </div>
  )
}
