'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { requireCompanyRole } from '@/lib/auth/permissions'
import {
  roundCost,
  roundCurrency,
} from '@/lib/product-costing'
import type {
  ActionResponse,
  Customer,
  Order,
  OrderFormData,
  OrderItem,
  OrderItemFormData,
  OrderStatus,
  OrderWithDetails,
  PaymentMethod,
  Product,
} from '@/types'

type CompanyContext = { companyId: string; userId: string }

type OrderRow = Order & {
  customer?: Customer | Customer[] | null
  order_items?: OrderItemRow[]
}

type OrderItemRow = OrderItem & {
  product?: Product | Product[] | null
}

const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  'pix_manual',
  'dinheiro',
  'cartao',
  'outro',
]

async function getCompanyId(): Promise<CompanyContext | { error: string }> {
  const result = await requireCompanyRole()
  if ('error' in result) return { error: result.error }
  return { companyId: result.companyId, userId: result.userId }
}

function revalidateOrderPaths(id?: string) {
  revalidatePath('/pedidos')
  revalidatePath('/clientes')
  revalidatePath('/ingredientes')
  revalidatePath('/dashboard')
  if (id) revalidatePath(`/pedidos/${id}`)
}

function getJoinedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeOrderItem(row: OrderItemRow): OrderItem {
  return {
    ...row,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    total_price: Number(row.total_price),
    unit_estimated_cost: Number(row.unit_estimated_cost ?? 0),
    total_estimated_cost: Number(row.total_estimated_cost ?? 0),
  }
}

function normalizeOrder(row: OrderRow): Order {
  return {
    ...row,
    discount: Number(row.discount),
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    estimated_cost: Number(row.estimated_cost),
    estimated_profit: Number(row.estimated_profit),
    cmv_percent: Number(row.cmv_percent ?? 0),
    stock_deducted: Boolean(row.stock_deducted),
  }
}

function normalizeOrderWithDetails(row: OrderRow): OrderWithDetails {
  const order = normalizeOrder(row)
  const customer = getJoinedOne(row.customer)
  const orderItems = (row.order_items ?? []).flatMap((item) => {
    const product = getJoinedOne(item.product)
    if (!product) return []

    return [
      {
        ...normalizeOrderItem(item),
        product: {
          ...product,
          sale_price: Number(product.sale_price),
          estimated_cost: Number(product.estimated_cost),
          gross_margin: Number(product.gross_margin),
          cmv_percent: Number(product.cmv_percent),
        },
      },
    ]
  })

  return {
    ...order,
    customer,
    order_items: orderItems,
  }
}

function parseOrderItems(value: FormDataEntryValue | null): OrderItemFormData[] {
  if (typeof value !== 'string') return []

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.map((item) => {
      const source = item as Partial<OrderItemFormData>
      return {
        product_id: String(source.product_id ?? ''),
        quantity: Number(source.quantity ?? 0),
        unit_price: Number(source.unit_price ?? 0),
      }
    })
  } catch {
    return []
  }
}

function parseOrderForm(formData: FormData):
  | { valid: true; data: OrderFormData }
  | { valid: false; error: string } {
  const customerId = (formData.get('customer_id') as string | null) || null
  const paymentMethodValue = (formData.get('payment_method') as string | null) || null
  const discount = Number(formData.get('discount') ?? 0)
  const notes = (formData.get('notes') as string | null)?.trim() || null
  const orderDate =
    (formData.get('order_date') as string | null)?.trim() || new Date().toISOString()
  const items = parseOrderItems(formData.get('items_json'))
  const errors: string[] = []

  const payment_method =
    paymentMethodValue && VALID_PAYMENT_METHODS.includes(paymentMethodValue as PaymentMethod)
      ? (paymentMethodValue as PaymentMethod)
      : null

  if (paymentMethodValue && !payment_method) errors.push('Forma de pagamento inválida.')
  if (Number.isNaN(discount) || discount < 0) errors.push('Desconto inválido.')
  if (Number.isNaN(Date.parse(orderDate))) errors.push('Data do pedido inválida.')
  if (items.length === 0) errors.push('Adicione pelo menos um produto ao pedido.')

  for (const item of items) {
    if (!item.product_id) errors.push('Selecione um produto em todos os itens.')
    if (Number.isNaN(item.quantity) || item.quantity <= 0) {
      errors.push('Quantidade deve ser maior que zero.')
    }
    if (Number.isNaN(item.unit_price) || item.unit_price < 0) {
      errors.push('Preço unitário inválido.')
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: Array.from(new Set(errors)).join(' ') }
  }

  return {
    valid: true,
    data: {
      customer_id: customerId,
      payment_method,
      discount,
      notes,
      order_date: new Date(orderDate).toISOString(),
      items,
    },
  }
}

async function validateCustomer(
  customerId: string | null,
  companyId: string,
): Promise<{ customerId: string | null } | { error: string }> {
  if (!customerId) return { customerId: null }

  const supabase = await createClient()
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('company_id', companyId)
    .single()

  if (!data) return { error: 'Cliente não encontrado.' }
  return { customerId }
}

async function buildOrderItems(
  items: OrderItemFormData[],
  companyId: string,
): Promise<
  | {
      rows: Array<
        Pick<
          OrderItem,
          | 'company_id'
          | 'product_id'
          | 'quantity'
          | 'unit_price'
          | 'total_price'
          | 'unit_estimated_cost'
          | 'total_estimated_cost'
        >
      >
      subtotal: number
      estimatedCost: number
    }
  | { error: string }
> {
  const productIds = Array.from(new Set(items.map((item) => item.product_id)))
  const supabase = await createClient()
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', companyId)
    .in('id', productIds)
    .returns<Product[]>()

  if (error) {
    console.error('buildOrderItems products error:', error.message)
    return { error: 'Erro ao validar produtos.' }
  }

  const productsById = new Map((products ?? []).map((product) => [product.id, product]))
  const rows = []
  let subtotal = 0
  let estimatedCost = 0

  for (const item of items) {
    const product = productsById.get(item.product_id)
    if (!product) return { error: 'Produto não encontrado.' }
    if (!product.is_active) return { error: `Produto inativo: ${product.name}.` }

    const quantity = Number(item.quantity)
    const unitPrice = roundCurrency(Number(item.unit_price))
    const unitEstimatedCost = roundCost(Number(product.estimated_cost))
    const totalPrice = roundCurrency(quantity * unitPrice)
    const totalEstimatedCost = roundCost(quantity * unitEstimatedCost)

    rows.push({
      company_id: companyId,
      product_id: product.id,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      unit_estimated_cost: unitEstimatedCost,
      total_estimated_cost: totalEstimatedCost,
    })

    subtotal += totalPrice
    estimatedCost += totalEstimatedCost
  }

  return {
    rows,
    subtotal: roundCurrency(subtotal),
    estimatedCost: roundCost(estimatedCost),
  }
}

function calculateOrderTotals(subtotal: number, discount: number, estimatedCost: number) {
  const total = roundCurrency(Math.max(0, subtotal - discount))
  const estimatedProfit = roundCurrency(total - estimatedCost)
  const cmvPercent = total > 0 ? roundCurrency((estimatedCost / total) * 100) : 0

  return {
    subtotal: roundCurrency(subtotal),
    total,
    estimated_cost: roundCost(estimatedCost),
    estimated_profit: estimatedProfit,
    cmv_percent: cmvPercent,
  }
}

function getRpcError(error: { message?: string } | null | undefined, fallback: string) {
  return error?.message ?? fallback
}

export async function getOrders(): Promise<OrderWithDetails[]> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, customer:customers(*), order_items(*, product:products(*))')
    .eq('company_id', companyResult.companyId)
    .order('order_date', { ascending: false })
    .returns<OrderRow[]>()

  if (error) {
    console.error('getOrders error:', error.message)
    return []
  }

  return (data ?? []).map(normalizeOrderWithDetails)
}

export async function getOrder(id: string): Promise<OrderWithDetails | null> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, customer:customers(*), order_items(*, product:products(*))')
    .eq('id', id)
    .eq('company_id', companyResult.companyId)
    .single<OrderRow>()

  if (error || !data) return null
  return normalizeOrderWithDetails(data)
}

export async function getOrderFormOptions(): Promise<{
  customers: Customer[]
  products: Product[]
}> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) return { customers: [], products: [] }

  const supabase = await createClient()
  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase
      .from('customers')
      .select('*')
      .eq('company_id', companyResult.companyId)
      .order('name')
      .returns<Customer[]>(),
    supabase
      .from('products')
      .select('*')
      .eq('company_id', companyResult.companyId)
      .eq('is_active', true)
      .order('name')
      .returns<Product[]>(),
  ])

  return {
    customers: customers ?? [],
    products: (products ?? []).map((product) => ({
      ...product,
      sale_price: Number(product.sale_price),
      estimated_cost: Number(product.estimated_cost),
      gross_margin: Number(product.gross_margin),
      cmv_percent: Number(product.cmv_percent),
    })),
  }
}

export async function createOrder(formData: FormData): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) return { success: false, error: companyResult.error }

  const parsed = parseOrderForm(formData)
  if (!parsed.valid) return { success: false, error: parsed.error }

  const customerResult = await validateCustomer(
    parsed.data.customer_id,
    companyResult.companyId,
  )
  if ('error' in customerResult) return { success: false, error: customerResult.error }

  const itemsResult = await buildOrderItems(parsed.data.items, companyResult.companyId)
  if ('error' in itemsResult) return { success: false, error: itemsResult.error }

  if (parsed.data.discount > itemsResult.subtotal) {
    return { success: false, error: 'Desconto não pode ser maior que o subtotal.' }
  }

  const totals = calculateOrderTotals(
    itemsResult.subtotal,
    parsed.data.discount,
    itemsResult.estimatedCost,
  )
  const supabase = await createClient()
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      company_id: companyResult.companyId,
      customer_id: customerResult.customerId,
      status: 'pendente',
      payment_method: parsed.data.payment_method,
      discount: parsed.data.discount,
      notes: parsed.data.notes,
      order_date: parsed.data.order_date,
      stock_deducted: false,
      ...totals,
    })
    .select('id')
    .single<{ id: string }>()

  if (orderError || !order) {
    console.error('createOrder order error:', orderError?.message)
    return { success: false, error: 'Erro ao criar pedido.' }
  }

  const { error: itemsError } = await supabase.from('order_items').insert(
    itemsResult.rows.map((item) => ({
      ...item,
      order_id: order.id,
    })),
  )

  if (itemsError) {
    console.error('createOrder items error:', itemsError.message)
    await supabase
      .from('orders')
      .delete()
      .eq('id', order.id)
      .eq('company_id', companyResult.companyId)
    return { success: false, error: 'Erro ao salvar itens do pedido.' }
  }

  revalidateOrderPaths(order.id)
  return { success: true }
}

export async function updateOrder(
  id: string,
  formData: FormData,
): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) return { success: false, error: companyResult.error }

  const parsed = parseOrderForm(formData)
  if (!parsed.valid) return { success: false, error: parsed.error }

  const supabase = await createClient()
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id,status')
    .eq('id', id)
    .eq('company_id', companyResult.companyId)
    .single<Pick<Order, 'id' | 'status'>>()

  if (!existingOrder) return { success: false, error: 'Pedido não encontrado.' }
  if (existingOrder.status !== 'pendente') {
    return { success: false, error: 'Pedidos pagos, entregues ou cancelados não podem ser editados.' }
  }

  const customerResult = await validateCustomer(
    parsed.data.customer_id,
    companyResult.companyId,
  )
  if ('error' in customerResult) return { success: false, error: customerResult.error }

  const itemsResult = await buildOrderItems(parsed.data.items, companyResult.companyId)
  if ('error' in itemsResult) return { success: false, error: itemsResult.error }

  if (parsed.data.discount > itemsResult.subtotal) {
    return { success: false, error: 'Desconto não pode ser maior que o subtotal.' }
  }

  const totals = calculateOrderTotals(
    itemsResult.subtotal,
    parsed.data.discount,
    itemsResult.estimatedCost,
  )

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      customer_id: customerResult.customerId,
      payment_method: parsed.data.payment_method,
      discount: parsed.data.discount,
      notes: parsed.data.notes,
      order_date: parsed.data.order_date,
      ...totals,
    })
    .eq('id', id)
    .eq('company_id', companyResult.companyId)

  if (updateError) {
    console.error('updateOrder order error:', updateError.message)
    return { success: false, error: 'Erro ao atualizar pedido.' }
  }

  const { error: deleteError } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', id)
    .eq('company_id', companyResult.companyId)

  if (deleteError) {
    console.error('updateOrder delete items error:', deleteError.message)
    return { success: false, error: 'Erro ao atualizar itens do pedido.' }
  }

  const { error: itemsError } = await supabase.from('order_items').insert(
    itemsResult.rows.map((item) => ({
      ...item,
      order_id: id,
    })),
  )

  if (itemsError) {
    console.error('updateOrder items error:', itemsError.message)
    return { success: false, error: 'Erro ao salvar itens do pedido.' }
  }

  revalidateOrderPaths(id)
  return { success: true }
}

export async function markOrderPaid(id: string): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) return { success: false, error: companyResult.error }

  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_order_paid_transactional', {
    p_company_id: companyResult.companyId,
    p_order_id: id,
  })

  if (error) {
    console.error('markOrderPaid rpc error:', error.message)
    return {
      success: false,
      error: getRpcError(error, 'Erro ao marcar pedido como pago.'),
    }
  }

  revalidateOrderPaths(id)
  return { success: true }
}

export async function markOrderDelivered(id: string): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) return { success: false, error: companyResult.error }

  const supabase = await createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id,status')
    .eq('id', id)
    .eq('company_id', companyResult.companyId)
    .single<Pick<Order, 'id' | 'status'>>()

  if (!order) return { success: false, error: 'Pedido não encontrado.' }
  if (order.status === 'pendente') {
    return { success: false, error: 'Marque o pedido como pago antes de entregar.' }
  }
  if (order.status === 'cancelado') {
    return { success: false, error: 'Pedido cancelado não pode ser entregue.' }
  }
  if (order.status === 'entregue') return { success: true }

  const { error } = await supabase
    .from('orders')
    .update({ status: 'entregue' satisfies OrderStatus })
    .eq('id', id)
    .eq('company_id', companyResult.companyId)

  if (error) {
    console.error('markOrderDelivered error:', error.message)
    return { success: false, error: 'Erro ao marcar pedido como entregue.' }
  }

  revalidateOrderPaths(id)
  return { success: true }
}

export async function cancelOrder(id: string): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) return { success: false, error: companyResult.error }

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_order_transactional', {
    p_company_id: companyResult.companyId,
    p_order_id: id,
  })

  if (error) {
    console.error('cancelOrder rpc error:', error.message)
    return {
      success: false,
      error: getRpcError(error, 'Erro ao cancelar pedido.'),
    }
  }

  revalidateOrderPaths(id)
  return { success: true }
}
