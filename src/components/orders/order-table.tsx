'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Eye, Search } from 'lucide-react'

import {
  formatCurrency,
  formatDateTime,
  ORDER_STATUSES,
  PAYMENT_METHODS,
} from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { OrderStatus, OrderWithDetails, PaymentMethod } from '@/types'

interface OrderTableProps {
  orders: OrderWithDetails[]
}

export function OrderTable({ orders }: OrderTableProps) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | 'all'>('all')
  const [date, setDate] = useState('')

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      const query = search.toLowerCase()
      const customerName = order.customer?.name.toLowerCase() ?? ''
      const productNames = order.order_items
        .map((item) => item.product.name.toLowerCase())
        .join(' ')
      const orderDate = order.order_date.slice(0, 10)

      return (
        (!query || customerName.includes(query) || productNames.includes(query)) &&
        (status === 'all' || order.status === status) &&
        (paymentMethod === 'all' || order.payment_method === paymentMethod) &&
        (!date || orderDate === date)
      )
    })
  }, [date, orders, paymentMethod, search, status])

  return (
    <div className="space-y-4">
      <div className="grid gap-2 lg:grid-cols-[1fr_180px_190px_170px]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou produto..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={status} onValueChange={(value) => setStatus(value as OrderStatus | 'all')}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {ORDER_STATUSES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={paymentMethod}
          onValueChange={(value) => setPaymentMethod(value as PaymentMethod | 'all')}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos pagamentos</SelectItem>
            {PAYMENT_METHODS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Pagamento</TableHead>
              <TableHead className="hidden lg:table-cell">Data</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhum pedido encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => {
                const statusInfo = ORDER_STATUSES.find((item) => item.value === order.status)
                const payment = PAYMENT_METHODS.find((item) => item.value === order.payment_method)

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      #{order.id.slice(0, 8)}
                      <p className="text-xs text-muted-foreground">
                        {order.order_items.length} item(ns)
                      </p>
                    </TableCell>
                    <TableCell>{order.customer?.name ?? 'Sem cliente'}</TableCell>
                    <TableCell>
                      <Badge className={statusInfo?.color}>{statusInfo?.label ?? order.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {payment?.label ?? '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {formatDateTime(order.order_date)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(order.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(order.estimated_profit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<Link href={`/pedidos/${order.id}`} />}
                      >
                        <Eye className="size-4" />
                        <span className="sr-only">Ver pedido</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
