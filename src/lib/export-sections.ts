import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  getUnitAbbrev,
  PAYMENT_METHODS,
} from '@/lib/constants'
import type {
  AdminReports,
  Customer,
  Ingredient,
  IngredientPurchase,
  OrderWithDetails,
  PaymentMethodReport,
  Product,
} from '@/types'
import type { ExportSection } from '@/lib/export-files'

type PurchaseIngredient = Pick<Ingredient, 'name' | 'unit'>

function getPurchaseIngredient(purchase: IngredientPurchase) {
  return purchase.ingredient as PurchaseIngredient | undefined
}

function getPaymentLabel(value: PaymentMethodReport['payment_method']) {
  if (value === 'sem_pagamento') return 'Sem pagamento'
  return PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value
}

export function ingredientsExportSections(ingredients: Ingredient[]): ExportSection[] {
  return [
    {
      title: 'Ingredientes',
      headers: [
        'Nome',
        'Unidade',
        'Estoque atual',
        'Custo médio',
        'Estoque mínimo',
        'Fornecedor',
      ],
      rows: ingredients.map((ingredient) => [
        ingredient.name,
        ingredient.unit,
        formatNumber(Number(ingredient.current_stock), 4),
        formatCurrency(Number(ingredient.average_cost)),
        formatNumber(Number(ingredient.min_stock), 4),
        ingredient.supplier ?? '',
      ]),
    },
  ]
}

export function purchasesExportSections(purchases: IngredientPurchase[]): ExportSection[] {
  return [
    {
      title: 'Compras',
      headers: [
        'Data',
        'Ingrediente',
        'Quantidade',
        'Unidade',
        'Valor total',
        'Fornecedor',
        'Observações',
      ],
      rows: purchases.map((purchase) => {
        const ingredient = getPurchaseIngredient(purchase)

        return [
          formatDate(purchase.purchased_at),
          ingredient?.name ?? '',
          formatNumber(Number(purchase.quantity), 4),
          ingredient ? getUnitAbbrev(ingredient.unit) : '',
          formatCurrency(Number(purchase.total_cost)),
          purchase.supplier ?? '',
          purchase.notes ?? '',
        ]
      }),
    },
  ]
}

export function productsExportSections(products: Product[]): ExportSection[] {
  return [
    {
      title: 'Produtos',
      headers: [
        'Nome',
        'Categoria',
        'Preço',
        'Custo estimado',
        'CMV',
        'Margem/Lucro bruto',
        'Status',
      ],
      rows: products.map((product) => [
        product.name,
        product.category ?? '',
        formatCurrency(Number(product.sale_price)),
        formatCurrency(Number(product.estimated_cost)),
        `${formatNumber(Number(product.cmv_percent))}%`,
        formatCurrency(Number(product.gross_margin)),
        product.is_active ? 'Ativo' : 'Inativo',
      ]),
    },
  ]
}

export function customersExportSections(customers: Customer[]): ExportSection[] {
  return [
    {
      title: 'Clientes',
      headers: [
        'Nome',
        'Telefone',
        'Email',
        'Total comprado',
        'Número de compras',
        'Última compra',
      ],
      rows: customers.map((customer) => [
        customer.name,
        customer.phone ?? '',
        customer.email ?? '',
        formatCurrency(Number(customer.total_spent)),
        customer.total_orders,
        customer.last_order_at ? formatDate(customer.last_order_at) : '',
      ]),
    },
  ]
}

export function ordersExportSections(orders: OrderWithDetails[]): ExportSection[] {
  return [
    {
      title: 'Pedidos',
      headers: [
        'Data',
        'Cliente',
        'Status',
        'Forma de pagamento',
        'Total',
        'Custo estimado',
        'Lucro bruto',
        'CMV',
      ],
      rows: orders.map((order) => [
        formatDateTime(order.order_date),
        order.customer?.name ?? 'Cliente não informado',
        order.status,
        order.payment_method ? getPaymentLabel(order.payment_method) : '',
        formatCurrency(Number(order.total)),
        formatCurrency(Number(order.estimated_cost)),
        formatCurrency(Number(order.estimated_profit)),
        `${formatNumber(Number(order.cmv_percent))}%`,
      ]),
    },
  ]
}

export function reportsExportSections(reports: AdminReports): ExportSection[] {
  return [
    {
      title: 'Resumo financeiro',
      headers: ['Métrica', 'Valor'],
      rows: [
        ['Período', reports.range.label],
        ['Faturamento bruto', formatCurrency(reports.summary.gross_revenue)],
        ['Descontos', formatCurrency(reports.summary.discounts)],
        ['Faturamento líquido', formatCurrency(reports.summary.net_revenue)],
        ['Custo estimado', formatCurrency(reports.summary.estimated_cost)],
        ['Lucro bruto', formatCurrency(reports.summary.gross_profit)],
        ['CMV médio', `${formatNumber(reports.summary.average_cmv_percent)}%`],
        ['Quantidade de pedidos', reports.summary.orders_count],
        ['Ticket médio', formatCurrency(reports.summary.average_ticket)],
      ],
    },
    {
      title: 'Produtos mais vendidos',
      headers: ['Produto', 'Quantidade vendida', 'Faturamento', 'Custo estimado', 'Lucro bruto', 'CMV'],
      rows: reports.top_products.map((product) => [
        product.product_name,
        formatNumber(product.quantity_sold, 4),
        formatCurrency(product.revenue),
        formatCurrency(product.estimated_cost),
        formatCurrency(product.gross_profit),
        `${formatNumber(product.cmv_percent)}%`,
      ]),
    },
    {
      title: 'Clientes recorrentes',
      headers: ['Cliente', 'Telefone', 'Total comprado', 'Número de pedidos', 'Última compra', 'Ticket médio'],
      rows: reports.recurring_customers.map((customer) => [
        customer.customer_name,
        customer.phone ?? '',
        formatCurrency(customer.total_spent),
        customer.orders_count,
        formatDateTime(customer.last_order_at),
        formatCurrency(customer.average_ticket),
      ]),
    },
    {
      title: 'Compras por período',
      headers: ['Ingrediente', 'Quantidade comprada', 'Valor total comprado', 'Fornecedor', 'Período'],
      rows: reports.ingredient_purchases.map((purchase) => [
        purchase.ingredient_name,
        formatNumber(purchase.quantity_purchased, 4),
        formatCurrency(purchase.total_purchased),
        purchase.supplier ?? '',
        purchase.period,
      ]),
    },
    {
      title: 'Vendas por forma de pagamento',
      headers: ['Forma de pagamento', 'Quantidade de pedidos', 'Valor total'],
      rows: reports.payment_methods.map((payment) => [
        getPaymentLabel(payment.payment_method),
        payment.orders_count,
        formatCurrency(payment.total),
      ]),
    },
  ]
}
