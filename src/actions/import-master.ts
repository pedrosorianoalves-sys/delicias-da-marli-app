'use server'

import { revalidatePath } from 'next/cache'

import { requireCompanyRole } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  areUnitsCompatible,
  convertQuantityToIngredientUnit,
  roundCost,
  roundCurrency,
} from '@/lib/product-costing'
import { recalculateProductMetrics } from '@/lib/supabase/product-metrics'
import type {
  ActionResponse,
  Customer,
  Ingredient,
  OrderStatus,
  PaymentMethod,
  Product,
  Unit,
} from '@/types'

const VALID_UNITS: Unit[] = ['g', 'kg', 'ml', 'l', 'unidade']
const VALID_ORDER_STATUSES: OrderStatus[] = ['pendente', 'pago', 'entregue', 'cancelado']
const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  'pix_manual',
  'dinheiro',
  'cartao',
  'outro',
]

type ImportPurchaseInput = {
  quantity?: unknown
  unit?: unknown
  total_price?: unknown
  supplier?: unknown
}

type ImportIngredientInput = {
  name?: unknown
  unit?: unknown
  initial_stock?: unknown
  minimum_stock?: unknown
  supplier?: unknown
  purchase?: ImportPurchaseInput
}

type ImportRecipeItemInput = {
  ingredient?: unknown
  quantity?: unknown
  unit?: unknown
}

type ImportProductInput = {
  name?: unknown
  category?: unknown
  description?: unknown
  sale_price?: unknown
  price?: unknown
  active?: unknown
  is_active?: unknown
  recipe?: ImportRecipeItemInput[]
}

type ImportCustomerInput = {
  name?: unknown
  phone?: unknown
  email?: unknown
  address?: unknown
  notes?: unknown
}

type ImportOrderCustomerInput = {
  name?: unknown
  phone?: unknown
  email?: unknown
}

type ImportOrderItemInput = {
  product?: unknown
  quantity?: unknown
  unit_price?: unknown
  courtesy_quantity?: unknown
}

type ImportOrderInput = {
  customer?: ImportOrderCustomerInput
  status?: unknown
  payment_method?: unknown
  discount?: unknown
  ordered_at?: unknown
  order_date?: unknown
  notes?: unknown
  items?: ImportOrderItemInput[]
}

type ImportPayload = {
  ingredients?: ImportIngredientInput[]
  products?: ImportProductInput[]
  customers?: ImportCustomerInput[]
  orders?: ImportOrderInput[]
}

export type ImportIssue = {
  path: string
  message: string
}

export type ImportPreview = {
  ingredients: {
    name: string
    unit: Unit
    initial_stock: number
    minimum_stock: number
    supplier: string | null
    has_purchase: boolean
  }[]
  purchases: {
    ingredient: string
    quantity: number
    unit: Unit
    total_price: number
    supplier: string | null
  }[]
  products: {
    name: string
    category: string | null
    sale_price: number
    active: boolean
  }[]
  recipes: {
    product: string
    ingredient: string
    quantity: number
    unit: Unit
  }[]
  customers: {
    name: string
    phone: string | null
    email: string | null
    action: 'novo' | 'atualizar' | 'reutilizar' | 'ambiguo'
    alerts: string[]
  }[]
  orders: {
    customer: string
    status: OrderStatus
    payment_method: PaymentMethod | null
    ordered_at: string
    items_count: number
    subtotal: number
    total: number
    will_deduct_stock: boolean
    alerts: string[]
  }[]
  order_items: {
    order_index: number
    product: string
    quantity: number
    courtesy_quantity: number
    unit_price: number | null
    product_found: boolean
  }[]
}

export type ImportSummary = {
  ingredients_created: number
  ingredients_updated: number
  purchases_created: number
  stock_movements_created: number
  products_created: number
  products_updated: number
  recipes_replaced: number
  recipe_items_created: number
  customers_created: number
  customers_updated: number
  orders_created: number
  orders_paid: number
  orders_pending: number
  orders_cancelled: number
  order_items_created: number
  orders_stock_deducted: number
}

export type ImportValidationResult = {
  success: boolean
  preview?: ImportPreview
  issues?: ImportIssue[]
  error?: string
}

export type ImportRunResult = ActionResponse<{
  preview: ImportPreview
  summary: ImportSummary
  issues: ImportIssue[]
}>

type NormalizedIngredient = {
  name: string
  unit: Unit
  initialStock: number
  minimumStock: number
  supplier: string | null
  hasInitialStock: boolean
  hasMinimumStock: boolean
  hasSupplier: boolean
  purchase: NormalizedPurchase | null
}

type NormalizedPurchase = {
  quantity: number
  unit: Unit
  totalPrice: number
  supplier: string | null
}

type NormalizedProduct = {
  name: string
  category: string | null
  description: string | null
  salePrice: number
  active: boolean
  recipe: NormalizedRecipeItem[]
}

type NormalizedCustomer = {
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  hasPhone: boolean
  hasEmail: boolean
  hasAddress: boolean
  hasNotes: boolean
}

type NormalizedOrderCustomer = Pick<
  NormalizedCustomer,
  'name' | 'phone' | 'email' | 'hasPhone' | 'hasEmail'
>

type NormalizedOrderItem = {
  product: string
  quantity: number
  unitPrice: number | null
  courtesyQuantity: number
}

type NormalizedOrder = {
  customer: NormalizedOrderCustomer
  status: OrderStatus
  paymentMethod: PaymentMethod | null
  discount: number
  orderedAt: string
  notes: string | null
  items: NormalizedOrderItem[]
}

type NormalizedRecipeItem = {
  ingredient: string
  quantity: number
  unit: Unit
}

type NormalizedPayload = {
  ingredients: NormalizedIngredient[]
  products: NormalizedProduct[]
  customers: NormalizedCustomer[]
  orders: NormalizedOrder[]
}

type IngredientRow = Pick<
  Ingredient,
  'id' | 'name' | 'unit' | 'current_stock' | 'average_cost'
> & {
  min_stock: number | string
  supplier: string | null
}

type ProductRow = Pick<Product, 'id' | 'name' | 'sale_price' | 'estimated_cost'>

type CustomerRow = Pick<
  Customer,
  | 'id'
  | 'name'
  | 'phone'
  | 'email'
  | 'address'
  | 'notes'
  | 'total_spent'
  | 'total_orders'
  | 'last_order_at'
>

type SupabaseErrorLike = {
  message?: string
  details?: string | null
  hint?: string | null
  code?: string | null
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}

function normalizePhone(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('55') && digits.length > 11) return digits.slice(2)
  return digits
}

function normalizeEmail(value: string | null | undefined) {
  const email = (value ?? '').trim().toLocaleLowerCase('pt-BR')
  return email || null
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asOptionalString(value: unknown) {
  const stringValue = asString(value)
  return stringValue || null
}

function asNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    return Number(value.replace(',', '.'))
  }
  return Number.NaN
}

function isUnit(value: unknown): value is Unit {
  return typeof value === 'string' && VALID_UNITS.includes(value as Unit)
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && VALID_ORDER_STATUSES.includes(value as OrderStatus)
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && VALID_PAYMENT_METHODS.includes(value as PaymentMethod)
}

function isValidEmail(value: string | null) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getCustomerMatchKey(customer: NormalizedOrderCustomer | NormalizedCustomer) {
  if (customer.phone) return `phone:${customer.phone}`
  if (customer.email) return `email:${customer.email}`
  return `name:${normalizeName(customer.name)}`
}

function getPreviewCustomers(normalized: NormalizedPayload) {
  const customers = new Map<string, NormalizedCustomer>()

  for (const customer of normalized.customers) {
    customers.set(getCustomerMatchKey(customer), customer)
  }

  for (const order of normalized.orders) {
    const customer = orderCustomerToCustomer(order.customer)
    const key = getCustomerMatchKey(customer)
    if (!customers.has(key)) customers.set(key, customer)
  }

  return Array.from(customers.values())
}

function formatSupabaseError({
  table,
  operation,
  subject,
  error,
}: {
  table: string
  operation: string
  subject: string
  error: SupabaseErrorLike | null | undefined
}) {
  const parts = [
    `Erro em ${table} ao ${operation} ${subject}: ${error?.message ?? 'erro desconhecido'}`,
  ]

  if (error?.details) parts.push(`Detalhes: ${error.details}`)
  if (error?.hint) parts.push(`Dica: ${error.hint}`)
  if (error?.code) parts.push(`Código: ${error.code}`)

  return parts.join(' ')
}

function errorMentions(error: SupabaseErrorLike | null | undefined, value: string) {
  const haystack = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('pt-BR')

  return haystack.includes(value.toLocaleLowerCase('pt-BR'))
}

function parsePayload(jsonText: string): { payload: ImportPayload } | { error: string } {
  try {
    const parsed = JSON.parse(jsonText) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: 'JSON deve ser um objeto.' }
    }
    return { payload: parsed as ImportPayload }
  } catch {
    return { error: 'JSON inválido. Confira vírgulas, aspas e chaves.' }
  }
}

function normalizePayload(payload: ImportPayload) {
  const issues: ImportIssue[] = []
  const ingredientsInput = Array.isArray(payload.ingredients)
    ? payload.ingredients
    : []
  const productsInput = Array.isArray(payload.products) ? payload.products : []
  const customersInput = Array.isArray(payload.customers) ? payload.customers : []
  const ordersInput = Array.isArray(payload.orders) ? payload.orders : []

  if (!Array.isArray(payload.ingredients) && payload.ingredients !== undefined) {
    issues.push({ path: 'ingredients', message: 'ingredients deve ser uma lista.' })
  }
  if (!Array.isArray(payload.products) && payload.products !== undefined) {
    issues.push({ path: 'products', message: 'products deve ser uma lista.' })
  }
  if (!Array.isArray(payload.customers) && payload.customers !== undefined) {
    issues.push({ path: 'customers', message: 'customers deve ser uma lista.' })
  }
  if (!Array.isArray(payload.orders) && payload.orders !== undefined) {
    issues.push({ path: 'orders', message: 'orders deve ser uma lista.' })
  }
  if (
    ingredientsInput.length === 0 &&
    productsInput.length === 0 &&
    customersInput.length === 0 &&
    ordersInput.length === 0
  ) {
    issues.push({
      path: '$',
      message: 'Informe pelo menos um ingrediente, produto, cliente ou pedido.',
    })
  }

  const ingredients: NormalizedIngredient[] = []
  const ingredientNames = new Set<string>()

  ingredientsInput.forEach((item, index) => {
    const path = `ingredients[${index}]`
    const name = asString(item.name)
    const unit = item.unit
    const initialStock =
      item.initial_stock === undefined ? 0 : asNumber(item.initial_stock)
    const minimumStock =
      item.minimum_stock === undefined ? 0 : asNumber(item.minimum_stock)
    const supplier = asOptionalString(item.supplier)

    if (!name) issues.push({ path: `${path}.name`, message: 'Nome é obrigatório.' })
    if (!isUnit(unit)) {
      issues.push({ path: `${path}.unit`, message: 'Unidade inválida.' })
    }
    if (Number.isNaN(initialStock) || initialStock < 0) {
      issues.push({
        path: `${path}.initial_stock`,
        message: 'Estoque inicial deve ser maior ou igual a zero.',
      })
    }
    if (Number.isNaN(minimumStock) || minimumStock < 0) {
      issues.push({
        path: `${path}.minimum_stock`,
        message: 'Estoque mínimo deve ser maior ou igual a zero.',
      })
    }

    const normalizedName = normalizeName(name)
    if (normalizedName && ingredientNames.has(normalizedName)) {
      issues.push({
        path: `${path}.name`,
        message: 'Ingrediente duplicado no JSON.',
      })
    }
    if (normalizedName) ingredientNames.add(normalizedName)

    let purchase: NormalizedPurchase | null = null
    if (item.purchase) {
      const purchasePath = `${path}.purchase`
      const quantity = asNumber(item.purchase.quantity)
      const purchaseUnit = item.purchase.unit ?? unit
      const totalPrice = asNumber(item.purchase.total_price)
      const purchaseSupplier = asOptionalString(item.purchase.supplier) ?? supplier

      if (Number.isNaN(quantity) || quantity <= 0) {
        issues.push({
          path: `${purchasePath}.quantity`,
          message: 'Quantidade da compra deve ser maior que zero.',
        })
      }
      if (!isUnit(purchaseUnit)) {
        issues.push({
          path: `${purchasePath}.unit`,
          message: 'Unidade da compra inválida.',
        })
      }
      if (Number.isNaN(totalPrice) || totalPrice < 0) {
        issues.push({
          path: `${purchasePath}.total_price`,
          message: 'Valor total da compra deve ser maior ou igual a zero.',
        })
      }
      if (isUnit(unit) && isUnit(purchaseUnit) && !areUnitsCompatible(unit, purchaseUnit)) {
        issues.push({
          path: `${purchasePath}.unit`,
          message: 'Unidade da compra incompatível com a unidade do ingrediente.',
        })
      }

      if (!Number.isNaN(quantity) && isUnit(purchaseUnit) && !Number.isNaN(totalPrice)) {
        purchase = {
          quantity,
          unit: purchaseUnit,
          totalPrice,
          supplier: purchaseSupplier,
        }
      }
    }

    if (name && isUnit(unit) && !Number.isNaN(initialStock) && !Number.isNaN(minimumStock)) {
      ingredients.push({
        name,
        unit,
        initialStock,
        minimumStock,
        supplier,
        hasInitialStock: item.initial_stock !== undefined,
        hasMinimumStock: item.minimum_stock !== undefined,
        hasSupplier: item.supplier !== undefined,
        purchase,
      })
    }
  })

  const products: NormalizedProduct[] = []
  const productNames = new Set<string>()

  productsInput.forEach((item, index) => {
    const path = `products[${index}]`
    const name = asString(item.name)
    const category = asOptionalString(item.category)
    const description = asOptionalString(item.description)
    const salePrice = asNumber(item.sale_price ?? item.price)
    const activeValue = item.active ?? item.is_active
    const active = activeValue === undefined ? true : Boolean(activeValue)
    const recipeInput = Array.isArray(item.recipe) ? item.recipe : []

    if (!name) issues.push({ path: `${path}.name`, message: 'Nome é obrigatório.' })
    if (Number.isNaN(salePrice) || salePrice <= 0) {
      issues.push({
        path: `${path}.sale_price`,
        message: 'Preço de venda deve ser maior que zero.',
      })
    }
    if (!Array.isArray(item.recipe)) {
      issues.push({ path: `${path}.recipe`, message: 'Receita deve ser uma lista.' })
    }

    const normalizedName = normalizeName(name)
    if (normalizedName && productNames.has(normalizedName)) {
      issues.push({ path: `${path}.name`, message: 'Produto duplicado no JSON.' })
    }
    if (normalizedName) productNames.add(normalizedName)

    const recipe: NormalizedRecipeItem[] = []
    recipeInput.forEach((recipeItem, recipeIndex) => {
      const recipePath = `${path}.recipe[${recipeIndex}]`
      const ingredient = asString(recipeItem.ingredient)
      const quantity = asNumber(recipeItem.quantity)
      const unit = recipeItem.unit

      if (!ingredient) {
        issues.push({
          path: `${recipePath}.ingredient`,
          message: 'Ingrediente da receita é obrigatório.',
        })
      }
      if (Number.isNaN(quantity) || quantity <= 0) {
        issues.push({
          path: `${recipePath}.quantity`,
          message: 'Quantidade da receita deve ser maior que zero.',
        })
      }
      if (!isUnit(unit)) {
        issues.push({ path: `${recipePath}.unit`, message: 'Unidade inválida.' })
      }

      if (ingredient && !Number.isNaN(quantity) && isUnit(unit)) {
        recipe.push({ ingredient, quantity, unit })
      }
    })

    if (name && !Number.isNaN(salePrice)) {
      products.push({ name, category, description, salePrice, active, recipe })
    }
  })

  const customers: NormalizedCustomer[] = []
  customersInput.forEach((item, index) => {
    const path = `customers[${index}]`
    const name = asString(item.name)
    const phone = normalizePhone(asOptionalString(item.phone))
    const email = normalizeEmail(asOptionalString(item.email))
    const address = asOptionalString(item.address)
    const notes = asOptionalString(item.notes)

    if (!name) issues.push({ path: `${path}.name`, message: 'Nome é obrigatório.' })
    if (!isValidEmail(email)) issues.push({ path: `${path}.email`, message: 'Email inválido.' })

    if (name && isValidEmail(email)) {
      customers.push({
        name,
        phone,
        email,
        address,
        notes,
        hasPhone: item.phone !== undefined,
        hasEmail: item.email !== undefined,
        hasAddress: item.address !== undefined,
        hasNotes: item.notes !== undefined,
      })
    }
  })

  const orders: NormalizedOrder[] = []
  ordersInput.forEach((item, index) => {
    const path = `orders[${index}]`
    const customerInput = item.customer
    const customerName = asString(customerInput?.name)
    const customerPhone = normalizePhone(asOptionalString(customerInput?.phone))
    const customerEmail = normalizeEmail(asOptionalString(customerInput?.email))
    const statusValue = item.status ?? 'pendente'
    const paymentMethodValue = item.payment_method
    const discount = item.discount === undefined ? 0 : asNumber(item.discount)
    const orderedAtValue = asString(item.ordered_at ?? item.order_date)
    const orderedAt = orderedAtValue || new Date().toISOString()
    const notes = asOptionalString(item.notes)
    const itemsInput = Array.isArray(item.items) ? item.items : []

    if (!customerInput || typeof customerInput !== 'object') {
      issues.push({ path: `${path}.customer`, message: 'Cliente do pedido é obrigatório.' })
    }
    if (!customerName) {
      issues.push({ path: `${path}.customer.name`, message: 'Nome do cliente é obrigatório.' })
    }
    if (!isValidEmail(customerEmail)) {
      issues.push({ path: `${path}.customer.email`, message: 'Email inválido.' })
    }
    if (!isOrderStatus(statusValue)) {
      issues.push({ path: `${path}.status`, message: 'Status do pedido inválido.' })
    }
    if (paymentMethodValue !== undefined && paymentMethodValue !== null && paymentMethodValue !== '') {
      if (!isPaymentMethod(paymentMethodValue)) {
        issues.push({
          path: `${path}.payment_method`,
          message: 'Forma de pagamento inválida.',
        })
      }
    }
    if (Number.isNaN(discount) || discount < 0) {
      issues.push({ path: `${path}.discount`, message: 'Desconto inválido.' })
    }
    if (Number.isNaN(Date.parse(orderedAt))) {
      issues.push({ path: `${path}.ordered_at`, message: 'Data do pedido inválida.' })
    }
    if (!Array.isArray(item.items)) {
      issues.push({ path: `${path}.items`, message: 'Itens do pedido devem ser uma lista.' })
    }
    if (itemsInput.length === 0) {
      issues.push({ path: `${path}.items`, message: 'Pedido deve ter ao menos um item.' })
    }

    const orderItems: NormalizedOrderItem[] = []
    itemsInput.forEach((orderItem, itemIndex) => {
      const itemPath = `${path}.items[${itemIndex}]`
      const product = asString(orderItem.product)
      const quantity = asNumber(orderItem.quantity)
      const unitPrice =
        orderItem.unit_price === undefined || orderItem.unit_price === null || orderItem.unit_price === ''
          ? null
          : asNumber(orderItem.unit_price)
      const courtesyQuantity =
        orderItem.courtesy_quantity === undefined
          ? 0
          : asNumber(orderItem.courtesy_quantity)

      if (!product) issues.push({ path: `${itemPath}.product`, message: 'Produto é obrigatório.' })
      if (Number.isNaN(quantity) || quantity <= 0) {
        issues.push({ path: `${itemPath}.quantity`, message: 'Quantidade deve ser maior que zero.' })
      }
      if (unitPrice !== null && (Number.isNaN(unitPrice) || unitPrice < 0)) {
        issues.push({ path: `${itemPath}.unit_price`, message: 'Preço unitário inválido.' })
      }
      if (Number.isNaN(courtesyQuantity) || courtesyQuantity < 0) {
        issues.push({
          path: `${itemPath}.courtesy_quantity`,
          message: 'Quantidade de cortesia deve ser maior ou igual a zero.',
        })
      }

      if (
        product &&
        !Number.isNaN(quantity) &&
        quantity > 0 &&
        (unitPrice === null || !Number.isNaN(unitPrice)) &&
        !Number.isNaN(courtesyQuantity) &&
        courtesyQuantity >= 0
      ) {
        orderItems.push({
          product,
          quantity,
          unitPrice,
          courtesyQuantity,
        })
      }
    })

    if (
      customerName &&
      isOrderStatus(statusValue) &&
      isValidEmail(customerEmail) &&
      !Number.isNaN(discount) &&
      !Number.isNaN(Date.parse(orderedAt)) &&
      orderItems.length > 0
    ) {
      orders.push({
        customer: {
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          hasPhone: customerInput?.phone !== undefined,
          hasEmail: customerInput?.email !== undefined,
        },
        status: statusValue,
        paymentMethod: isPaymentMethod(paymentMethodValue) ? paymentMethodValue : null,
        discount,
        orderedAt: new Date(orderedAt).toISOString(),
        notes,
        items: orderItems,
      })
    }
  })

  const preview = buildPreview({ ingredients, products, customers, orders })
  return { normalized: { ingredients, products, customers, orders }, preview, issues }
}

function buildPreview(normalized: NormalizedPayload): ImportPreview {
  return {
    ingredients: normalized.ingredients.map((ingredient) => ({
      name: ingredient.name,
      unit: ingredient.unit,
      initial_stock: ingredient.initialStock,
      minimum_stock: ingredient.minimumStock,
      supplier: ingredient.supplier,
      has_purchase: !!ingredient.purchase,
    })),
    purchases: normalized.ingredients.flatMap((ingredient) =>
      ingredient.purchase
        ? [
            {
              ingredient: ingredient.name,
              quantity: ingredient.purchase.quantity,
              unit: ingredient.purchase.unit,
              total_price: ingredient.purchase.totalPrice,
              supplier: ingredient.purchase.supplier,
            },
          ]
        : [],
    ),
    products: normalized.products.map((product) => ({
      name: product.name,
      category: product.category,
      sale_price: product.salePrice,
      active: product.active,
    })),
    recipes: normalized.products.flatMap((product) =>
      product.recipe.map((item) => ({
        product: product.name,
        ingredient: item.ingredient,
        quantity: item.quantity,
        unit: item.unit,
      })),
    ),
    customers: getPreviewCustomers(normalized).map((customer) => ({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      action: 'novo',
      alerts: [],
    })),
    orders: normalized.orders.map((order) => {
      const subtotal = order.items.reduce((sum, item) => {
        return sum + item.quantity * Number(item.unitPrice ?? 0)
      }, 0)

      return {
        customer: order.customer.name,
        status: order.status,
        payment_method: order.paymentMethod,
        ordered_at: order.orderedAt,
        items_count: order.items.length,
        subtotal: roundCurrency(subtotal),
        total: roundCurrency(Math.max(0, subtotal - order.discount)),
        will_deduct_stock: order.status === 'pago' || order.status === 'entregue',
        alerts: [],
      }
    }),
    order_items: normalized.orders.flatMap((order, orderIndex) =>
      order.items.map((item) => ({
        order_index: orderIndex,
        product: item.product,
        quantity: item.quantity,
        courtesy_quantity: item.courtesyQuantity,
        unit_price: item.unitPrice,
        product_found: false,
      })),
    ),
  }
}

function revalidateImportPaths() {
  revalidatePath('/importar')
  revalidatePath('/ingredientes')
  revalidatePath('/compras')
  revalidatePath('/produtos')
  revalidatePath('/receitas')
  revalidatePath('/clientes')
  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
}

async function insertProductWithMetrics({
  supabase,
  companyId,
  productInput,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  companyId: string
  productInput: NormalizedProduct
}) {
  const productData = {
    company_id: companyId,
    name: productInput.name,
    category: productInput.category,
    description: productInput.description,
    sale_price: productInput.salePrice,
    is_active: productInput.active,
    estimated_cost: 0,
    gross_margin: 0,
  }

  const insert = await supabase
    .from('products')
    .insert({
      ...productData,
      cmv_percent: 0,
    })
    .select('id, name, sale_price, estimated_cost')
    .single<ProductRow>()

  if (!insert.error) return insert

  if (!errorMentions(insert.error, 'cmv_percent')) return insert

  return supabase
    .from('products')
    .insert({
      ...productData,
      cmv: 0,
    })
    .select('id, name, sale_price, estimated_cost')
    .single<ProductRow>()
}

async function updateProductWithMetrics({
  supabase,
  companyId,
  productId,
  productInput,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  companyId: string
  productId: string
  productInput: NormalizedProduct
}) {
  const productData = {
    category: productInput.category,
    description: productInput.description,
    sale_price: productInput.salePrice,
    is_active: productInput.active,
  }

  const update = await supabase
    .from('products')
    .update(productData)
    .eq('id', productId)
    .eq('company_id', companyId)

  return update
}

function getCustomerMatches(customers: CustomerRow[], customer: NormalizedOrderCustomer | NormalizedCustomer) {
  if (customer.phone) {
    return customers.filter((row) => normalizePhone(row.phone) === customer.phone)
  }

  if (customer.email) {
    return customers.filter((row) => normalizeEmail(row.email) === customer.email)
  }

  return customers.filter((row) => normalizeName(row.name) === normalizeName(customer.name))
}

function shouldUpdateCustomer(existing: CustomerRow, customer: NormalizedCustomer) {
  if (existing.name !== customer.name) return true
  if (customer.hasPhone && customer.phone && normalizePhone(existing.phone) !== customer.phone) return true
  if (customer.hasEmail && customer.email && normalizeEmail(existing.email) !== customer.email) return true
  if (customer.hasAddress && customer.address && existing.address !== customer.address) return true
  if (customer.hasNotes && customer.notes && existing.notes !== customer.notes) return true
  return false
}

function getCustomerUpdatePayload(customer: NormalizedCustomer) {
  const payload: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'address' | 'notes'>> = {
    name: customer.name,
  }

  if (customer.hasPhone && customer.phone) payload.phone = customer.phone
  if (customer.hasEmail && customer.email) payload.email = customer.email
  if (customer.hasAddress && customer.address) payload.address = customer.address
  if (customer.hasNotes && customer.notes) payload.notes = customer.notes

  return payload
}

function buildProductGroups(products: ProductRow[]) {
  const productsByName = new Map<string, ProductRow[]>()

  for (const product of products) {
    const key = normalizeName(product.name)
    productsByName.set(key, [...(productsByName.get(key) ?? []), product])
  }

  return productsByName
}

function resolveProductByName(
  productsByName: Map<string, ProductRow[]>,
  name: string,
): { product: ProductRow } | { error: string } {
  const matches = productsByName.get(normalizeName(name)) ?? []
  if (matches.length === 1 && matches[0]) return { product: matches[0] }
  if (matches.length > 1) return { error: 'Produto ambíguo.' }
  return { error: 'Produto não encontrado.' }
}

function getOrderTotals(items: Array<{
  chargedQuantity: number
  courtesyQuantity: number
  unitPrice: number
  estimatedCost: number
}>, discount: number) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.chargedQuantity * item.unitPrice,
    0,
  )
  const estimatedCost = items.reduce(
    (sum, item) =>
      sum + (item.chargedQuantity + item.courtesyQuantity) * item.estimatedCost,
    0,
  )
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

async function buildDatabasePreview({
  supabase,
  companyId,
  normalized,
  basePreview,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  companyId: string
  normalized: NormalizedPayload
  basePreview: ImportPreview
}) {
  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, phone, email, address, notes, total_spent, total_orders, last_order_at')
      .eq('company_id', companyId)
      .returns<CustomerRow[]>(),
    supabase
      .from('products')
      .select('id, name, sale_price, estimated_cost')
      .eq('company_id', companyId)
      .returns<ProductRow[]>(),
  ])

  const customerRows = customers ?? []
  const productRows = products ?? []
  const productsByName = buildProductGroups([
    ...productRows,
    ...normalized.products.map((product) => ({
      id: '',
      name: product.name,
      sale_price: product.salePrice,
      estimated_cost: 0,
    })),
  ])

  return {
    ...basePreview,
    customers: getPreviewCustomers(normalized).map((customer) => {
      const matches = getCustomerMatches(customerRows, customer)
      const alerts =
        matches.length > 1
          ? ['Cliente ambíguo: mais de um cadastro possível.']
          : []
      const action =
        matches.length > 1
          ? 'ambiguo'
          : matches.length === 0
            ? 'novo'
            : shouldUpdateCustomer(matches[0], customer)
              ? 'atualizar'
              : 'reutilizar'

      return {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        action,
        alerts,
      }
    }),
    orders: normalized.orders.map((order) => {
      const alerts: string[] = []
      const customerMatches = getCustomerMatches(customerRows, order.customer)

      if (customerMatches.length > 1) {
        alerts.push('Cliente ambíguo: pedido não será importado automaticamente.')
      }

      const subtotal = order.items.reduce((sum, item) => {
        const productResult = resolveProductByName(productsByName, item.product)
        if ('error' in productResult) {
          alerts.push(`${item.product}: ${productResult.error}`)
          return sum
        }

        return sum + item.quantity * Number(item.unitPrice ?? productResult.product.sale_price)
      }, 0)

      if (order.status === 'cancelado') {
        alerts.push('Pedido cancelado será criado sem baixa de estoque.')
      }

      return {
        customer: order.customer.name,
        status: order.status,
        payment_method: order.paymentMethod,
        ordered_at: order.orderedAt,
        items_count: order.items.length,
        subtotal: roundCurrency(subtotal),
        total: roundCurrency(Math.max(0, subtotal - order.discount)),
        will_deduct_stock: order.status === 'pago' || order.status === 'entregue',
        alerts: Array.from(new Set(alerts)),
      }
    }),
    order_items: normalized.orders.flatMap((order, orderIndex) =>
      order.items.map((item) => {
        const productResult = resolveProductByName(productsByName, item.product)

        return {
          order_index: orderIndex,
          product: item.product,
          quantity: item.quantity,
          courtesy_quantity: item.courtesyQuantity,
          unit_price:
            item.unitPrice ??
            ('product' in productResult ? Number(productResult.product.sale_price) : null),
          product_found: 'product' in productResult,
        }
      }),
    ),
  } satisfies ImportPreview
}

async function upsertImportCustomer({
  supabase,
  companyId,
  customerInput,
  customerRows,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  companyId: string
  customerInput: NormalizedCustomer
  customerRows: CustomerRow[]
}): Promise<
  | { customer: CustomerRow; action: 'created' | 'updated' | 'reused' }
  | { error: string }
> {
  const matches = getCustomerMatches(customerRows, customerInput)

  if (matches.length > 1) {
    return { error: 'Cliente ambíguo: mais de um cadastro possível.' }
  }

  if (matches.length === 1) {
    const existing = matches[0]
    if (!shouldUpdateCustomer(existing, customerInput)) {
      return { customer: existing, action: 'reused' }
    }

    const { data, error } = await supabase
      .from('customers')
      .update(getCustomerUpdatePayload(customerInput))
      .eq('id', existing.id)
      .eq('company_id', companyId)
      .select('id, name, phone, email, address, notes, total_spent, total_orders, last_order_at')
      .single<CustomerRow>()

    if (error || !data) {
      return {
        error: formatSupabaseError({
          table: 'customers',
          operation: 'atualizar cliente',
          subject: customerInput.name,
          error,
        }),
      }
    }

    const index = customerRows.findIndex((customer) => customer.id === data.id)
    if (index >= 0) customerRows[index] = data
    return { customer: data, action: 'updated' }
  }

  const { data, error } = await supabase
    .from('customers')
    .insert({
      company_id: companyId,
      name: customerInput.name,
      phone: customerInput.phone,
      email: customerInput.email,
      address: customerInput.address,
      notes: customerInput.notes,
      total_spent: 0,
      total_orders: 0,
      last_order_at: null,
    })
    .select('id, name, phone, email, address, notes, total_spent, total_orders, last_order_at')
    .single<CustomerRow>()

  if (error || !data) {
    return {
      error: formatSupabaseError({
        table: 'customers',
        operation: 'criar cliente',
        subject: customerInput.name,
        error,
      }),
    }
  }

  customerRows.push(data)
  return { customer: data, action: 'created' }
}

function orderCustomerToCustomer(orderCustomer: NormalizedOrderCustomer): NormalizedCustomer {
  return {
    name: orderCustomer.name,
    phone: orderCustomer.phone,
    email: orderCustomer.email,
    address: null,
    notes: null,
    hasPhone: orderCustomer.hasPhone,
    hasEmail: orderCustomer.hasEmail,
    hasAddress: false,
    hasNotes: false,
  }
}

async function importNormalizedOrder({
  supabase,
  companyId,
  orderInput,
  orderIndex,
  customerRows,
  productsByName,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  companyId: string
  orderInput: NormalizedOrder
  orderIndex: number
  customerRows: CustomerRow[]
  productsByName: Map<string, ProductRow[]>
}): Promise<
  | {
      paid: boolean
      pending: boolean
      cancelled: boolean
      orderItemsCreated: number
      stockMovementsCreated: number
      customerAction: 'created' | 'updated' | 'reused'
    }
  | { error: string }
> {
  const customerResult = await upsertImportCustomer({
    supabase,
    companyId,
    customerInput: orderCustomerToCustomer(orderInput.customer),
    customerRows,
  })

  if ('error' in customerResult) {
    return { error: `orders[${orderIndex}].customer: ${customerResult.error}` }
  }

  const resolvedItems: Array<{
    product: ProductRow
    chargedQuantity: number
    courtesyQuantity: number
    unitPrice: number
    estimatedCost: number
  }> = []

  for (const [itemIndex, item] of orderInput.items.entries()) {
    const productResult = resolveProductByName(productsByName, item.product)
    if ('error' in productResult) {
      return {
        error: `orders[${orderIndex}].items[${itemIndex}].product: ${productResult.error}`,
      }
    }

    resolvedItems.push({
      product: productResult.product,
      chargedQuantity: item.quantity,
      courtesyQuantity: item.courtesyQuantity,
      unitPrice: roundCurrency(Number(item.unitPrice ?? productResult.product.sale_price)),
      estimatedCost: roundCost(Number(productResult.product.estimated_cost ?? 0)),
    })
  }

  const totals = getOrderTotals(resolvedItems, orderInput.discount)
  if (orderInput.discount > totals.subtotal) {
    return { error: `orders[${orderIndex}].discount: Desconto maior que subtotal.` }
  }

  const initialStatus = orderInput.status === 'cancelado' ? 'cancelado' : 'pendente'
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      company_id: companyId,
      customer_id: customerResult.customer.id,
      status: initialStatus,
      payment_method: orderInput.paymentMethod,
      discount: orderInput.discount,
      subtotal: totals.subtotal,
      total: totals.total,
      estimated_cost: totals.estimated_cost,
      estimated_profit: totals.estimated_profit,
      cmv_percent: totals.cmv_percent,
      stock_deducted: false,
      notes: orderInput.notes,
      order_date: orderInput.orderedAt,
    })
    .select('id')
    .single<{ id: string }>()

  if (orderError || !order) {
    return {
      error: formatSupabaseError({
        table: 'orders',
        operation: 'criar pedido',
        subject: String(orderIndex + 1),
        error: orderError,
      }),
    }
  }

  const itemRows = resolvedItems.flatMap((item) => {
    const rows = [
      {
        company_id: companyId,
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.chargedQuantity,
        unit_price: item.unitPrice,
        total_price: roundCurrency(item.chargedQuantity * item.unitPrice),
        unit_estimated_cost: item.estimatedCost,
        total_estimated_cost: roundCost(item.chargedQuantity * item.estimatedCost),
      },
    ]

    if (item.courtesyQuantity > 0) {
      rows.push({
        company_id: companyId,
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.courtesyQuantity,
        unit_price: 0,
        total_price: 0,
        unit_estimated_cost: item.estimatedCost,
        total_estimated_cost: roundCost(item.courtesyQuantity * item.estimatedCost),
      })
    }

    return rows
  })

  const { error: itemsError } = await supabase.from('order_items').insert(itemRows)

  if (itemsError) {
    await supabase.from('orders').delete().eq('id', order.id).eq('company_id', companyId)
    return {
      error: formatSupabaseError({
        table: 'order_items',
        operation: 'criar itens do pedido',
        subject: String(orderIndex + 1),
        error: itemsError,
      }),
    }
  }

  if (orderInput.status === 'pago' || orderInput.status === 'entregue') {
    const { error: paidError } = await supabase.rpc('mark_order_paid_transactional', {
      p_company_id: companyId,
      p_order_id: order.id,
    })

    if (paidError) {
      await supabase.from('orders').delete().eq('id', order.id).eq('company_id', companyId)
      return {
        error: formatSupabaseError({
          table: 'orders',
          operation: 'marcar pedido como pago',
          subject: String(orderIndex + 1),
          error: paidError,
        }),
      }
    }

    if (orderInput.status === 'entregue') {
      const { error: deliveredError } = await supabase
        .from('orders')
        .update({ status: 'entregue' satisfies OrderStatus })
        .eq('id', order.id)
        .eq('company_id', companyId)

      if (deliveredError) {
        return {
          error: formatSupabaseError({
            table: 'orders',
            operation: 'marcar pedido como entregue',
            subject: String(orderIndex + 1),
            error: deliveredError,
          }),
        }
      }
    }

    const { count } = await supabase
      .from('stock_movements')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('reference_type', 'order')
      .eq('reference_id', order.id)
      .eq('type', 'out')

    return {
      paid: true,
      pending: false,
      cancelled: false,
      orderItemsCreated: itemRows.length,
      stockMovementsCreated: count ?? 0,
      customerAction: customerResult.action,
    }
  }

  return {
    paid: false,
    pending: orderInput.status === 'pendente',
    cancelled: orderInput.status === 'cancelado',
    orderItemsCreated: itemRows.length,
    stockMovementsCreated: 0,
    customerAction: customerResult.action,
  }
}

export async function validateMasterImportJson(
  jsonText: string,
): Promise<ImportValidationResult> {
  const context = await requireCompanyRole()
  if ('error' in context) return { success: false, error: context.error }

  const parsed = parsePayload(jsonText)
  if ('error' in parsed) return { success: false, error: parsed.error }

  const { normalized, preview, issues } = normalizePayload(parsed.payload)
  const supabase = await createClient()
  const databasePreview =
    issues.length === 0
      ? await buildDatabasePreview({
          supabase,
          companyId: context.companyId,
          normalized,
          basePreview: preview,
        })
      : preview

  return {
    success: issues.length === 0,
    preview: databasePreview,
    issues,
    error: issues.length > 0 ? 'Corrija os erros antes de importar.' : undefined,
  }
}

export async function importMasterJson(jsonText: string): Promise<ImportRunResult> {
  const context = await requireCompanyRole()
  if ('error' in context) return { success: false, error: context.error }

  const parsed = parsePayload(jsonText)
  if ('error' in parsed) return { success: false, error: parsed.error }

  const { normalized, preview, issues } = normalizePayload(parsed.payload)
  if (issues.length > 0) {
    return {
      success: false,
      error: 'Corrija os erros antes de importar.',
      data: {
        preview,
        summary: emptySummary(),
        issues,
      },
    }
  }

  const supabase = await createClient()
  const summary = emptySummary()
  const importIssues: ImportIssue[] = []
  const importPreview = await buildDatabasePreview({
    supabase,
    companyId: context.companyId,
    normalized,
    basePreview: preview,
  })

  const { data: existingIngredients, error: ingredientsError } = await supabase
    .from('ingredients')
    .select('id, name, unit, current_stock, average_cost, min_stock, supplier')
    .eq('company_id', context.companyId)
    .returns<IngredientRow[]>()

  if (ingredientsError) {
    console.error('importMasterJson ingredients read error:', ingredientsError.message)
    return { success: false, error: 'Erro ao carregar ingredientes atuais.' }
  }

  const ingredientsByName = new Map<string, IngredientRow>()
  for (const ingredient of existingIngredients ?? []) {
    ingredientsByName.set(normalizeName(ingredient.name), ingredient)
  }

  const { data: existingCustomers, error: customersError } = await supabase
    .from('customers')
    .select('id, name, phone, email, address, notes, total_spent, total_orders, last_order_at')
    .eq('company_id', context.companyId)
    .returns<CustomerRow[]>()

  if (customersError) {
    console.error('importMasterJson customers read error:', customersError.message)
    return { success: false, error: 'Erro ao carregar clientes atuais.' }
  }

  const customerRows = [...(existingCustomers ?? [])]

  for (const ingredientInput of normalized.ingredients) {
    const key = normalizeName(ingredientInput.name)
    const existing = ingredientsByName.get(key)

    if (existing && !areUnitsCompatible(existing.unit, ingredientInput.unit)) {
      importIssues.push({
        path: `ingredients.${ingredientInput.name}.unit`,
        message: 'Ingrediente existente tem unidade incompatível.',
      })
      continue
    }

    let ingredient = existing

    if (!ingredient) {
      const currentStock = ingredientInput.purchase ? 0 : ingredientInput.initialStock
      const { data: created, error } = await supabase
        .from('ingredients')
        .insert({
          company_id: context.companyId,
          name: ingredientInput.name,
          unit: ingredientInput.unit,
          current_stock: currentStock,
          average_cost: 0,
          min_stock: ingredientInput.minimumStock,
          supplier: ingredientInput.supplier,
        })
        .select('id, name, unit, current_stock, average_cost, min_stock, supplier')
        .single<IngredientRow>()

      if (error || !created) {
        console.error('importMasterJson ingredient create error:', error)
        importIssues.push({
          path: `ingredients.${ingredientInput.name}`,
          message: formatSupabaseError({
            table: 'ingredients',
            operation: 'criar ingrediente',
            subject: ingredientInput.name,
            error,
          }),
        })
        continue
      }

      ingredient = created
      ingredientsByName.set(key, created)
      summary.ingredients_created += 1

      if (!ingredientInput.purchase && ingredientInput.initialStock > 0) {
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            company_id: context.companyId,
            ingredient_id: created.id,
            type: 'in',
            quantity: ingredientInput.initialStock,
            reference_type: 'manual',
            cost_at_time: 0,
            notes: 'Estoque inicial importado',
          })

        if (!movementError) summary.stock_movements_created += 1
      }
    } else {
      const updatePayload: { min_stock?: number; supplier?: string | null } = {}

      if (ingredientInput.hasMinimumStock) {
        updatePayload.min_stock = ingredientInput.minimumStock
      }

      if (ingredientInput.hasSupplier) {
        updatePayload.supplier = ingredientInput.supplier
      }

      if (Object.keys(updatePayload).length === 0) {
        ingredientsByName.set(key, ingredient)
      } else {
        const { error } = await supabase
          .from('ingredients')
          .update(updatePayload)
          .eq('id', ingredient.id)
          .eq('company_id', context.companyId)

        if (error) {
          console.error('importMasterJson ingredient update error:', error)
          importIssues.push({
            path: `ingredients.${ingredientInput.name}`,
            message: formatSupabaseError({
              table: 'ingredients',
              operation: 'atualizar ingrediente',
              subject: ingredientInput.name,
              error,
            }),
          })
          continue
        }

        ingredient = {
          ...ingredient,
          ...updatePayload,
        }
        ingredientsByName.set(key, ingredient)
        summary.ingredients_updated += 1
      }
    }

    if (ingredientInput.purchase) {
      const purchase = ingredientInput.purchase
      const quantityInIngredientUnit = convertQuantityToIngredientUnit(
        purchase.quantity,
        purchase.unit,
        ingredient.unit,
      )

      if (quantityInIngredientUnit === null || quantityInIngredientUnit <= 0) {
        importIssues.push({
          path: `ingredients.${ingredientInput.name}.purchase.unit`,
          message: 'Unidade da compra incompatível com a unidade do ingrediente.',
        })
        continue
      }

      const unitCost = purchase.totalPrice / quantityInIngredientUnit
      const purchaseNotes =
        purchase.unit === ingredient.unit
          ? 'Compra importada'
          : `Compra importada (${purchase.quantity}${purchase.unit})`

      let duplicatePurchaseQuery = supabase
        .from('ingredient_purchases')
        .select('id')
        .eq('company_id', context.companyId)
        .eq('ingredient_id', ingredient.id)
        .eq('quantity', quantityInIngredientUnit)
        .eq('total_cost', purchase.totalPrice)
        .eq('notes', purchaseNotes)
        .limit(1)

      duplicatePurchaseQuery = purchase.supplier
        ? duplicatePurchaseQuery.eq('supplier', purchase.supplier)
        : duplicatePurchaseQuery.is('supplier', null)

      const { data: duplicatePurchase, error: duplicatePurchaseError } =
        await duplicatePurchaseQuery.maybeSingle<{ id: string }>()

      if (duplicatePurchaseError) {
        console.error(
          'importMasterJson duplicate purchase read error:',
          duplicatePurchaseError,
        )
        importIssues.push({
          path: `ingredients.${ingredientInput.name}.purchase`,
          message: formatSupabaseError({
            table: 'ingredient_purchases',
            operation: 'verificar compra existente de',
            subject: ingredientInput.name,
            error: duplicatePurchaseError,
          }),
        })
        continue
      }

      if (duplicatePurchase) {
        continue
      }

      const { error: purchaseError } = await supabase.rpc(
        'create_ingredient_purchase_transactional',
        {
          p_company_id: context.companyId,
          p_ingredient_id: ingredient.id,
          p_quantity: quantityInIngredientUnit,
          p_unit_cost: unitCost,
          p_supplier: purchase.supplier,
          p_notes: purchaseNotes,
          p_purchased_at: new Date().toISOString(),
        },
      )

      if (purchaseError) {
        console.error('importMasterJson purchase error:', purchaseError)
        importIssues.push({
          path: `ingredients.${ingredientInput.name}.purchase`,
          message: formatSupabaseError({
            table: 'ingredient_purchases',
            operation: 'registrar compra de',
            subject: ingredientInput.name,
            error: purchaseError,
          }),
        })
        continue
      }
      summary.stock_movements_created += 1
      summary.purchases_created += 1
    }
  }

  for (const customerInput of normalized.customers) {
    const customerResult = await upsertImportCustomer({
      supabase,
      companyId: context.companyId,
      customerInput,
      customerRows,
    })

    if ('error' in customerResult) {
      importIssues.push({
        path: `customers.${customerInput.name}`,
        message: customerResult.error,
      })
      continue
    }

    if (customerResult.action === 'created') summary.customers_created += 1
    if (customerResult.action === 'updated') summary.customers_updated += 1
  }

  const { data: existingProducts, error: productsError } = await supabase
    .from('products')
    .select('id, name, sale_price, estimated_cost')
    .eq('company_id', context.companyId)
    .returns<ProductRow[]>()

  if (productsError) {
    console.error('importMasterJson products read error:', productsError.message)
    return { success: false, error: 'Erro ao carregar produtos atuais.' }
  }

  const productsByName = new Map<string, ProductRow>()
  for (const product of existingProducts ?? []) {
    productsByName.set(normalizeName(product.name), product)
  }

  for (const productInput of normalized.products) {
    const key = normalizeName(productInput.name)
    let product = productsByName.get(key)
    const recipeValidationIssues = productInput.recipe.flatMap((item) => {
      const ingredient = ingredientsByName.get(normalizeName(item.ingredient))

      if (!ingredient) {
        return [
          {
            path: `products.${productInput.name}.recipe.${item.ingredient}`,
            message: 'Ingrediente da receita não encontrado.',
          },
        ]
      }

      if (!areUnitsCompatible(ingredient.unit, item.unit)) {
        return [
          {
            path: `products.${productInput.name}.recipe.${item.ingredient}`,
            message: 'Unidade da receita incompatível com o ingrediente.',
          },
        ]
      }

      return []
    })

    if (recipeValidationIssues.length > 0) {
      importIssues.push(...recipeValidationIssues)
      continue
    }

    if (!product) {
      const { data: created, error } = await insertProductWithMetrics({
        supabase,
        companyId: context.companyId,
        productInput,
      })

      if (error || !created) {
        console.error('importMasterJson product create error:', error)
        importIssues.push({
          path: `products.${productInput.name}`,
          message: formatSupabaseError({
            table: 'products',
            operation: 'criar produto',
            subject: productInput.name,
            error,
          }),
        })
        continue
      }

      product = created
      productsByName.set(key, created)
      summary.products_created += 1
    } else {
      const { error } = await updateProductWithMetrics({
        supabase,
        companyId: context.companyId,
        productId: product.id,
        productInput,
      })

      if (error) {
        console.error('importMasterJson product update error:', error)
        importIssues.push({
          path: `products.${productInput.name}`,
          message: formatSupabaseError({
            table: 'products',
            operation: 'atualizar produto',
            subject: productInput.name,
            error,
          }),
        })
        continue
      }

      product = { ...product, sale_price: productInput.salePrice }
      productsByName.set(key, product)
      summary.products_updated += 1
    }

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .upsert(
        {
          company_id: context.companyId,
          product_id: product.id,
          yield_quantity: 1,
        },
        { onConflict: 'product_id' },
      )
      .select('id')
      .single<{ id: string }>()

    if (recipeError || !recipe) {
      console.error('importMasterJson recipe upsert error:', recipeError)
      importIssues.push({
        path: `products.${productInput.name}.recipe`,
        message: formatSupabaseError({
          table: 'recipes',
          operation: 'criar ficha técnica de',
          subject: productInput.name,
          error: recipeError,
        }),
      })
      continue
    }

    const { error: deleteError } = await supabase
      .from('recipe_items')
      .delete()
      .eq('recipe_id', recipe.id)
      .eq('company_id', context.companyId)

    if (deleteError) {
      console.error('importMasterJson recipe clear error:', deleteError)
      importIssues.push({
        path: `products.${productInput.name}.recipe`,
        message: formatSupabaseError({
          table: 'recipe_items',
          operation: 'limpar ficha técnica de',
          subject: productInput.name,
          error: deleteError,
        }),
      })
      continue
    }

    const recipeItems = productInput.recipe.flatMap((item) => {
      const ingredient = ingredientsByName.get(normalizeName(item.ingredient))
      if (!ingredient) {
        importIssues.push({
          path: `products.${productInput.name}.recipe.${item.ingredient}`,
          message: 'Ingrediente da receita não encontrado.',
        })
        return []
      }

      if (!areUnitsCompatible(ingredient.unit, item.unit)) {
        importIssues.push({
          path: `products.${productInput.name}.recipe.${item.ingredient}`,
          message: 'Unidade da receita incompatível com o ingrediente.',
        })
        return []
      }

      return [
        {
          company_id: context.companyId,
          recipe_id: recipe.id,
          ingredient_id: ingredient.id,
          quantity: item.quantity,
          unit: item.unit,
        },
      ]
    })

    if (recipeItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('recipe_items')
        .insert(recipeItems)

      if (itemsError) {
        console.error('importMasterJson recipe items error:', itemsError)
        importIssues.push({
          path: `products.${productInput.name}.recipe`,
          message: formatSupabaseError({
            table: 'recipe_items',
            operation: 'importar itens da ficha técnica de',
            subject: productInput.name,
            error: itemsError,
          }),
        })
        continue
      }

      summary.recipe_items_created += recipeItems.length
    }

    const recalculated = await recalculateProductMetrics(product.id, context.companyId)
    if (!recalculated.success) {
      importIssues.push({
        path: `products.${productInput.name}.recipe`,
        message: recalculated.error,
      })
      continue
    }

    summary.recipes_replaced += 1
  }

  const { data: orderProducts, error: orderProductsError } = await supabase
    .from('products')
    .select('id, name, sale_price, estimated_cost')
    .eq('company_id', context.companyId)
    .returns<ProductRow[]>()

  if (orderProductsError) {
    console.error('importMasterJson order products read error:', orderProductsError.message)
    return { success: false, error: 'Erro ao carregar produtos para pedidos.' }
  }

  const orderProductsByName = buildProductGroups(orderProducts ?? [])

  for (const [orderIndex, orderInput] of normalized.orders.entries()) {
    const orderResult = await importNormalizedOrder({
      supabase,
      companyId: context.companyId,
      orderInput,
      orderIndex,
      customerRows,
      productsByName: orderProductsByName,
    })

    if ('error' in orderResult) {
      importIssues.push({
        path: `orders[${orderIndex}]`,
        message: orderResult.error,
      })
      continue
    }

    summary.orders_created += 1
    summary.order_items_created += orderResult.orderItemsCreated
    summary.stock_movements_created += orderResult.stockMovementsCreated
    summary.orders_stock_deducted += orderResult.paid ? 1 : 0
    if (orderResult.paid) summary.orders_paid += 1
    if (orderResult.pending) summary.orders_pending += 1
    if (orderResult.cancelled) summary.orders_cancelled += 1
    if (orderResult.customerAction === 'created') summary.customers_created += 1
    if (orderResult.customerAction === 'updated') summary.customers_updated += 1
  }

  revalidateImportPaths()

  return {
    success: importIssues.length === 0,
    error: importIssues.length > 0 ? 'Importação concluída com avisos.' : undefined,
    data: { preview: importPreview, summary, issues: importIssues },
  }
}

function emptySummary(): ImportSummary {
  return {
    ingredients_created: 0,
    ingredients_updated: 0,
    purchases_created: 0,
    stock_movements_created: 0,
    products_created: 0,
    products_updated: 0,
    recipes_replaced: 0,
    recipe_items_created: 0,
    customers_created: 0,
    customers_updated: 0,
    orders_created: 0,
    orders_paid: 0,
    orders_pending: 0,
    orders_cancelled: 0,
    order_items_created: 0,
    orders_stock_deducted: 0,
  }
}
