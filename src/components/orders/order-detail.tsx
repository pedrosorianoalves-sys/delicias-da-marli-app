'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { cancelOrder, markOrderDelivered, markOrderPaid } from '@/actions/orders'
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  ORDER_STATUSES,
  PAYMENT_METHODS,
} from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { OrderWithDetails } from '@/types'

interface OrderDetailProps {
  order: OrderWithDetails
}

type RunningAction = 'paid' | 'delivered' | 'cancel' | null

export function OrderDetail({ order }: OrderDetailProps) {
  const router = useRouter()
  const [runningAction, setRunningAction] = useState<RunningAction>(null)
  const [isPending, startTransition] = useTransition()
  const statusInfo = ORDER_STATUSES.find((item) => item.value === order.status)
  const payment = PAYMENT_METHODS.find((item) => item.value === order.payment_method)

  function runAction(action: RunningAction, callback: () => Promise<{ success: boolean; error?: string }>) {
    setRunningAction(action)
    startTransition(async () => {
      const result = await callback()
      setRunningAction(null)

      if (result.success) {
        toast.success('Pedido atualizado!')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erro ao atualizar pedido.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={statusInfo?.color}>{statusInfo?.label ?? order.status}</Badge>
          </CardContent>
        </Card>
        <MetricCard label="Total" value={formatCurrency(order.total)} />
        <MetricCard label="Lucro bruto" value={formatCurrency(order.estimated_profit)} />
        <MetricCard label="CMV" value={`${formatNumber(order.cmv_percent)}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-3">
          <InfoItem label="Cliente" value={order.customer?.name ?? 'Sem cliente'} />
          <InfoItem label="Data" value={formatDateTime(order.order_date)} />
          <InfoItem label="Pagamento" value={payment?.label ?? '-'} />
          <InfoItem label="Subtotal" value={formatCurrency(order.subtotal)} />
          <InfoItem label="Desconto" value={formatCurrency(order.discount)} />
          <InfoItem
            label="Estoque baixado"
            value={order.stock_deducted ? 'Sim' : 'Não'}
          />
          {order.notes && (
            <div className="md:col-span-3">
              <p className="text-xs text-muted-foreground">Observações</p>
              <p className="mt-1">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Preço un.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.order_items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(item.quantity, 4)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(item.unit_price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(item.total_price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(item.total_estimated_cost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {order.status === 'pendente' && (
          <Button
            onClick={() => runAction('paid', () => markOrderPaid(order.id))}
            disabled={isPending}
          >
            {runningAction === 'paid' ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Marcando...
              </>
            ) : (
              'Marcar como pago'
            )}
          </Button>
        )}

        {order.status === 'pago' && (
          <Button
            variant="secondary"
            onClick={() => runAction('delivered', () => markOrderDelivered(order.id))}
            disabled={isPending}
          >
            {runningAction === 'delivered' ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Marcando...
              </>
            ) : (
              'Marcar como entregue'
            )}
          </Button>
        )}

        {order.status !== 'cancelado' && (
          <Dialog>
            <DialogTrigger render={<Button variant="destructive" disabled={isPending} />}>
              Cancelar pedido
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancelar pedido</DialogTitle>
                <DialogDescription>
                  Se o estoque já foi baixado, ele será devolvido e o histórico do cliente será ajustado.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Voltar
                </DialogClose>
                <Button
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => runAction('cancel', () => cancelOrder(order.id))}
                >
                  {runningAction === 'cancel' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    'Confirmar cancelamento'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  )
}
