import { BarChart3, CalendarDays, DollarSign, Percent, ShoppingBag, TrendingUp } from 'lucide-react'

import { getAdminReports } from '@/actions/reports'
import { ExportButtons } from '@/components/export/export-buttons'
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  getUnitAbbrev,
  PAYMENT_METHODS,
} from '@/lib/constants'
import { reportsExportSections } from '@/lib/export-sections'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  AdminReports,
  IngredientConsumptionReport,
  IngredientPurchasesReport,
  PaymentMethodReport,
  ProductSalesReport,
} from '@/types'

interface ReportsPageProps {
  searchParams: Promise<{
    period?: string | string[]
    start?: string | string[]
    end?: string | string[]
  }>
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const filters = await searchParams
  const reports = await getAdminReports(filters)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe faturamento, lucro, CMV, produtos, clientes e estoque.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <ReportsFilter range={reports.range} />
          <ExportButtons
            title={`Relatórios ${reports.range.label}`}
            sections={reportsExportSections(reports)}
            className="justify-end"
          />
        </div>
      </div>

      <SummaryCards reports={reports} />

      <div className="grid gap-6 xl:grid-cols-2">
        <ProductsTable products={reports.top_products} />
        <CustomersTable customers={reports.recurring_customers} />
        <IngredientConsumptionTable ingredients={reports.ingredient_consumption} />
        <PaymentMethodsTable payments={reports.payment_methods} />
      </div>

      <PurchasesTable purchases={reports.ingredient_purchases} />
    </div>
  )
}

function ReportsFilter({ range }: { range: AdminReports['range'] }) {
  return (
    <form
      className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[170px_150px_150px_auto]"
      method="get"
    >
      <label className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Período</span>
        <select
          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          defaultValue={range.preset}
          name="period"
        >
          <option value="today">Hoje</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="month">Mês atual</option>
          <option value="custom">Personalizado</option>
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Data inicial</span>
        <input
          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          defaultValue={range.start_date}
          name="start"
          type="date"
        />
      </label>

      <label className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Data final</span>
        <input
          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          defaultValue={range.end_date}
          name="end"
          type="date"
        />
      </label>

      <button
        className="mt-auto h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        type="submit"
      >
        Filtrar
      </button>
    </form>
  )
}

function SummaryCards({ reports }: { reports: AdminReports }) {
  const summary = reports.summary
  const cards = [
    {
      label: 'Faturamento bruto',
      value: formatCurrency(summary.gross_revenue),
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Descontos',
      value: formatCurrency(summary.discounts),
      icon: CalendarDays,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Faturamento líquido',
      value: formatCurrency(summary.net_revenue),
      icon: ShoppingBag,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Custo estimado',
      value: formatCurrency(summary.estimated_cost),
      icon: BarChart3,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: 'Lucro bruto',
      value: formatCurrency(summary.gross_profit),
      icon: TrendingUp,
      color: 'text-pink-600',
      bg: 'bg-pink-50',
    },
    {
      label: 'CMV médio',
      value: `${formatNumber(summary.average_cmv_percent)}%`,
      icon: Percent,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
    {
      label: 'Pedidos',
      value: String(summary.orders_count),
      icon: ShoppingBag,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(summary.average_ticket),
      icon: DollarSign,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.label} size="sm">
            <CardContent>
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${card.bg}`}>
                  <Icon className={`size-5 ${card.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="text-lg font-bold tracking-tight">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function ProductsTable({ products }: { products: ProductSalesReport[] }) {
  return (
    <ReportCard title="Produtos mais vendidos">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead className="text-right">Qtd.</TableHead>
            <TableHead className="text-right">Faturamento</TableHead>
            <TableHead className="text-right">Custo</TableHead>
            <TableHead className="text-right">Lucro</TableHead>
            <TableHead className="text-right">CMV</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <EmptyRow colSpan={6} />
          ) : (
            products.map((product) => (
              <TableRow key={product.product_id}>
                <TableCell className="font-medium">{product.product_name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(product.quantity_sold, 4)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(product.revenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(product.estimated_cost)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(product.gross_profit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(product.cmv_percent)}%
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ReportCard>
  )
}

function CustomersTable({
  customers,
}: {
  customers: AdminReports['recurring_customers']
}) {
  return (
    <ReportCard title="Clientes recorrentes">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead className="hidden md:table-cell">Telefone</TableHead>
            <TableHead className="text-right">Pedidos</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="hidden lg:table-cell">Última compra</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.length === 0 ? (
            <EmptyRow colSpan={5} />
          ) : (
            customers.map((customer) => (
              <TableRow key={customer.customer_id}>
                <TableCell className="font-medium">
                  {customer.customer_name}
                  <p className="text-xs text-muted-foreground">
                    Ticket {formatCurrency(customer.average_ticket)}
                  </p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {customer.phone ?? '-'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {customer.orders_count}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(customer.total_spent)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {formatDateTime(customer.last_order_at)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ReportCard>
  )
}

function IngredientConsumptionTable({
  ingredients,
}: {
  ingredients: IngredientConsumptionReport[]
}) {
  return (
    <ReportCard title="Ingredientes mais consumidos">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ingrediente</TableHead>
            <TableHead className="text-right">Quantidade</TableHead>
            <TableHead className="text-right">Custo estimado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingredients.length === 0 ? (
            <EmptyRow colSpan={3} />
          ) : (
            ingredients.map((ingredient) => (
              <TableRow key={ingredient.ingredient_id}>
                <TableCell className="font-medium">{ingredient.ingredient_name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(ingredient.quantity_consumed, 4)}{' '}
                  {getUnitAbbrev(ingredient.unit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(ingredient.estimated_cost_consumed)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ReportCard>
  )
}

function PaymentMethodsTable({ payments }: { payments: PaymentMethodReport[] }) {
  return (
    <ReportCard title="Vendas por forma de pagamento">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Forma</TableHead>
            <TableHead className="text-right">Pedidos</TableHead>
            <TableHead className="text-right">Valor total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.payment_method}>
              <TableCell className="font-medium">
                {getPaymentLabel(payment.payment_method)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {payment.orders_count}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(payment.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ReportCard>
  )
}

function PurchasesTable({ purchases }: { purchases: IngredientPurchasesReport[] }) {
  return (
    <ReportCard title="Compras de ingredientes">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ingrediente</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Período</TableHead>
            <TableHead className="text-right">Quantidade</TableHead>
            <TableHead className="text-right">Valor total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.length === 0 ? (
            <EmptyRow colSpan={5} />
          ) : (
            purchases.map((purchase) => (
              <TableRow key={`${purchase.ingredient_id}:${purchase.supplier}`}>
                <TableCell className="font-medium">{purchase.ingredient_name}</TableCell>
                <TableCell>{purchase.supplier ?? '-'}</TableCell>
                <TableCell>{purchase.period}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(purchase.quantity_purchased, 4)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(purchase.total_purchased)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ReportCard>
  )
}

function ReportCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-20 text-center text-muted-foreground">
        Nenhum dado encontrado para o período.
      </TableCell>
    </TableRow>
  )
}

function getPaymentLabel(value: PaymentMethodReport['payment_method']) {
  if (value === 'sem_pagamento') return 'Sem pagamento'
  return PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value
}
