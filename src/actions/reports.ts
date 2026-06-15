'use server'

import { createClient } from '@/lib/supabase/server'
import { requireCompanyRole } from '@/lib/auth/permissions'
import { roundCost, roundCurrency } from '@/lib/product-costing'
import type {
  AdminReports,
  Customer,
  Ingredient,
  IngredientConsumptionReport,
  IngredientPurchase,
  IngredientPurchasesReport,
  Order,
  OrderItem,
  PaymentMethod,
  PaymentMethodReport,
  Product,
  ProductSalesReport,
  ReportDateRange,
  ReportPeriodPreset,
  StockMovement,
} from '@/types'

type ReportFilters = {
  period?: string | string[]
  start?: string | string[]
  end?: string | string[]
}

type OrderReportRow = Pick<
  Order,
  | 'id'
  | 'customer_id'
  | 'payment_method'
  | 'discount'
  | 'subtotal'
  | 'total'
  | 'estimated_cost'
  | 'estimated_profit'
  | 'order_date'
> & {
  customer?: Pick<Customer, 'id' | 'name' | 'phone'> | Pick<Customer, 'id' | 'name' | 'phone'>[] | null
  order_items?: OrderItemReportRow[]
}

type OrderItemReportRow = Pick<
  OrderItem,
  'product_id' | 'quantity' | 'total_price' | 'total_estimated_cost'
> & {
  product?: Pick<Product, 'id' | 'name'> | Pick<Product, 'id' | 'name'>[] | null
}

type StockMovementReportRow = Pick<
  StockMovement,
  'ingredient_id' | 'quantity' | 'cost_at_time'
> & {
  ingredient?: Pick<Ingredient, 'id' | 'name' | 'unit'> | Pick<Ingredient, 'id' | 'name' | 'unit'>[] | null
}

type PurchaseReportRow = Pick<
  IngredientPurchase,
  'ingredient_id' | 'quantity' | 'total_cost' | 'supplier' | 'purchased_at'
> & {
  ingredient?: Pick<Ingredient, 'id' | 'name' | 'unit'> | Pick<Ingredient, 'id' | 'name' | 'unit'>[] | null
}

async function getCompanyId(): Promise<string | null> {
  const result = await requireCompanyRole()
  if ('error' in result) return null
  return result.companyId
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function formatRangeLabel(start: Date, endExclusive: Date) {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const endInclusive = addDays(endExclusive, -1)
  return `${formatter.format(start)} a ${formatter.format(endInclusive)}`
}

function resolveReportDateRange(filters: ReportFilters): ReportDateRange {
  const now = new Date()
  const today = startOfDay(now)
  const presetValue = getSingleParam(filters.period)
  const preset: ReportPeriodPreset =
    presetValue === '7d' || presetValue === 'month' || presetValue === 'custom'
      ? presetValue
      : 'today'

  let start = today
  let end = addDays(today, 1)

  if (preset === '7d') {
    start = addDays(today, -6)
  }

  if (preset === 'month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1)
  }

  if (preset === 'custom') {
    const startValue = getSingleParam(filters.start)
    const endValue = getSingleParam(filters.end)
    const parsedStart = startValue ? new Date(`${startValue}T00:00:00`) : null
    const parsedEnd = endValue ? new Date(`${endValue}T00:00:00`) : null

    if (parsedStart && !Number.isNaN(parsedStart.getTime())) {
      start = parsedStart
    }
    if (parsedEnd && !Number.isNaN(parsedEnd.getTime())) {
      end = addDays(parsedEnd, 1)
    }
    if (end <= start) {
      end = addDays(start, 1)
    }
  }

  const label =
    preset === 'today'
      ? 'Hoje'
      : preset === '7d'
        ? 'Últimos 7 dias'
        : preset === 'month'
          ? 'Mês atual'
          : formatRangeLabel(start, end)

  return {
    preset,
    start_date: toDateInputValue(start),
    end_date: toDateInputValue(addDays(end, -1)),
    label,
  }
}

function getJoinedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function createEmptyReports(range: ReportDateRange): AdminReports {
  return {
    range,
    summary: {
      gross_revenue: 0,
      discounts: 0,
      net_revenue: 0,
      estimated_cost: 0,
      gross_profit: 0,
      average_cmv_percent: 0,
      orders_count: 0,
      average_ticket: 0,
    },
    top_products: [],
    recurring_customers: [],
    ingredient_consumption: [],
    ingredient_purchases: [],
    payment_methods: [
      { payment_method: 'pix_manual', orders_count: 0, total: 0 },
      { payment_method: 'dinheiro', orders_count: 0, total: 0 },
      { payment_method: 'cartao', orders_count: 0, total: 0 },
      { payment_method: 'outro', orders_count: 0, total: 0 },
    ],
  }
}

function summarizeFinancial(orders: OrderReportRow[]) {
  const grossRevenue = orders.reduce((sum, order) => sum + Number(order.subtotal), 0)
  const discounts = orders.reduce((sum, order) => sum + Number(order.discount), 0)
  const netRevenue = orders.reduce((sum, order) => sum + Number(order.total), 0)
  const estimatedCost = orders.reduce(
    (sum, order) => sum + Number(order.estimated_cost),
    0,
  )
  const grossProfit = orders.reduce(
    (sum, order) => sum + Number(order.estimated_profit),
    0,
  )

  return {
    gross_revenue: roundCurrency(grossRevenue),
    discounts: roundCurrency(discounts),
    net_revenue: roundCurrency(netRevenue),
    estimated_cost: roundCost(estimatedCost),
    gross_profit: roundCurrency(grossProfit),
    average_cmv_percent:
      netRevenue > 0 ? roundCurrency((estimatedCost / netRevenue) * 100) : 0,
    orders_count: orders.length,
    average_ticket:
      orders.length > 0 ? roundCurrency(netRevenue / orders.length) : 0,
  }
}

function summarizeProducts(orders: OrderReportRow[]): ProductSalesReport[] {
  const grouped = new Map<string, ProductSalesReport>()

  for (const order of orders) {
    for (const item of order.order_items ?? []) {
      const product = getJoinedOne(item.product)
      const productId = item.product_id
      const existing = grouped.get(productId)
      const revenue = Number(item.total_price)
      const estimatedCost = Number(item.total_estimated_cost)

      if (existing) {
        existing.quantity_sold = roundCost(existing.quantity_sold + Number(item.quantity))
        existing.revenue = roundCurrency(existing.revenue + revenue)
        existing.estimated_cost = roundCost(existing.estimated_cost + estimatedCost)
        existing.gross_profit = roundCurrency(existing.revenue - existing.estimated_cost)
        existing.cmv_percent =
          existing.revenue > 0
            ? roundCurrency((existing.estimated_cost / existing.revenue) * 100)
            : 0
      } else {
        grouped.set(productId, {
          product_id: productId,
          product_name: product?.name ?? 'Produto removido',
          quantity_sold: roundCost(Number(item.quantity)),
          revenue: roundCurrency(revenue),
          estimated_cost: roundCost(estimatedCost),
          gross_profit: roundCurrency(revenue - estimatedCost),
          cmv_percent: revenue > 0 ? roundCurrency((estimatedCost / revenue) * 100) : 0,
        })
      }
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.quantity_sold - a.quantity_sold)
}

function summarizeCustomers(orders: OrderReportRow[]) {
  const grouped = new Map<string, CustomerRecurringReportInternal>()

  for (const order of orders) {
    if (!order.customer_id) continue

    const customer = getJoinedOne(order.customer)
    const existing = grouped.get(order.customer_id)
    const total = Number(order.total)
    const orderDate = order.order_date

    if (existing) {
      existing.total_spent = roundCurrency(existing.total_spent + total)
      existing.orders_count += 1
      if (orderDate > existing.last_order_at) existing.last_order_at = orderDate
      existing.average_ticket = roundCurrency(existing.total_spent / existing.orders_count)
    } else {
      grouped.set(order.customer_id, {
        customer_id: order.customer_id,
        customer_name: customer?.name ?? 'Cliente removido',
        phone: customer?.phone ?? null,
        total_spent: roundCurrency(total),
        orders_count: 1,
        last_order_at: orderDate,
        average_ticket: roundCurrency(total),
      })
    }
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.orders_count !== a.orders_count) return b.orders_count - a.orders_count
    return b.total_spent - a.total_spent
  })
}

type CustomerRecurringReportInternal = AdminReports['recurring_customers'][number]

function summarizePayments(orders: OrderReportRow[]): PaymentMethodReport[] {
  const grouped = new Map<PaymentMethod | 'sem_pagamento', PaymentMethodReport>([
    ['pix_manual', { payment_method: 'pix_manual', orders_count: 0, total: 0 }],
    ['dinheiro', { payment_method: 'dinheiro', orders_count: 0, total: 0 }],
    ['cartao', { payment_method: 'cartao', orders_count: 0, total: 0 }],
    ['outro', { payment_method: 'outro', orders_count: 0, total: 0 }],
  ])

  for (const order of orders) {
    const key = order.payment_method ?? 'sem_pagamento'
    const existing =
      grouped.get(key) ??
      ({ payment_method: key, orders_count: 0, total: 0 } satisfies PaymentMethodReport)

    existing.orders_count += 1
    existing.total = roundCurrency(existing.total + Number(order.total))
    grouped.set(key, existing)
  }

  return Array.from(grouped.values())
}

function summarizeConsumption(
  movements: StockMovementReportRow[],
): IngredientConsumptionReport[] {
  const grouped = new Map<string, IngredientConsumptionReport>()

  for (const movement of movements) {
    const ingredient = getJoinedOne(movement.ingredient)
    const ingredientId = movement.ingredient_id
    const quantity = Number(movement.quantity)
    const cost = quantity * Number(movement.cost_at_time)
    const existing = grouped.get(ingredientId)

    if (existing) {
      existing.quantity_consumed = roundCost(existing.quantity_consumed + quantity)
      existing.estimated_cost_consumed = roundCost(existing.estimated_cost_consumed + cost)
    } else if (ingredient) {
      grouped.set(ingredientId, {
        ingredient_id: ingredientId,
        ingredient_name: ingredient.name,
        quantity_consumed: roundCost(quantity),
        unit: ingredient.unit,
        estimated_cost_consumed: roundCost(cost),
      })
    }
  }

  return Array.from(grouped.values()).sort(
    (a, b) => b.estimated_cost_consumed - a.estimated_cost_consumed,
  )
}

function summarizePurchases(
  purchases: PurchaseReportRow[],
  range: ReportDateRange,
): IngredientPurchasesReport[] {
  const grouped = new Map<string, IngredientPurchasesReport>()

  for (const purchase of purchases) {
    const ingredient = getJoinedOne(purchase.ingredient)
    const supplier = purchase.supplier?.trim() || 'Sem fornecedor'
    const key = `${purchase.ingredient_id}:${supplier}`
    const existing = grouped.get(key)

    if (existing) {
      existing.quantity_purchased = roundCost(
        existing.quantity_purchased + Number(purchase.quantity),
      )
      existing.total_purchased = roundCurrency(
        existing.total_purchased + Number(purchase.total_cost),
      )
    } else {
      grouped.set(key, {
        ingredient_id: purchase.ingredient_id,
        ingredient_name: ingredient?.name ?? 'Ingrediente removido',
        quantity_purchased: roundCost(Number(purchase.quantity)),
        total_purchased: roundCurrency(Number(purchase.total_cost)),
        supplier,
        period: range.label,
      })
    }
  }

  return Array.from(grouped.values()).sort(
    (a, b) => b.total_purchased - a.total_purchased,
  )
}

export async function getAdminReports(filters: ReportFilters): Promise<AdminReports> {
  const range = resolveReportDateRange(filters)
  const companyId = await getCompanyId()

  if (!companyId) return createEmptyReports(range)

  const supabase = await createClient()
  const start = new Date(`${range.start_date}T00:00:00`).toISOString()
  const end = new Date(`${range.end_date}T00:00:00`)
  end.setDate(end.getDate() + 1)
  const endExclusive = end.toISOString()

  const [{ data: orders, error: ordersError }, { data: purchases, error: purchasesError }] =
    await Promise.all([
      supabase
        .from('orders')
        .select(
          'id, customer_id, payment_method, discount, subtotal, total, estimated_cost, estimated_profit, order_date, customer:customers(id, name, phone), order_items(product_id, quantity, total_price, total_estimated_cost, product:products(id, name))',
        )
        .eq('company_id', companyId)
        .in('status', ['pago', 'entregue'])
        .gte('order_date', start)
        .lt('order_date', endExclusive)
        .order('order_date', { ascending: false })
        .returns<OrderReportRow[]>(),
      supabase
        .from('ingredient_purchases')
        .select(
          'ingredient_id, quantity, total_cost, supplier, purchased_at, ingredient:ingredients(id, name, unit)',
        )
        .eq('company_id', companyId)
        .gte('purchased_at', start)
        .lt('purchased_at', endExclusive)
        .order('purchased_at', { ascending: false })
        .returns<PurchaseReportRow[]>(),
    ])

  if (ordersError) console.error('getAdminReports orders error:', ordersError.message)
  if (purchasesError) {
    console.error('getAdminReports purchases error:', purchasesError.message)
  }

  const validOrders = orders ?? []
  const orderIds = validOrders.map((order) => order.id)
  let movements: StockMovementReportRow[] = []

  if (orderIds.length > 0) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('ingredient_id, quantity, cost_at_time, ingredient:ingredients(id, name, unit)')
      .eq('company_id', companyId)
      .eq('reference_type', 'order')
      .eq('type', 'out')
      .in('reference_id', orderIds)
      .returns<StockMovementReportRow[]>()

    if (error) console.error('getAdminReports movements error:', error.message)
    movements = data ?? []
  }

  return {
    range,
    summary: summarizeFinancial(validOrders),
    top_products: summarizeProducts(validOrders),
    recurring_customers: summarizeCustomers(validOrders),
    ingredient_consumption: summarizeConsumption(movements),
    ingredient_purchases: summarizePurchases(purchases ?? [], range),
    payment_methods: summarizePayments(validOrders),
  }
}
