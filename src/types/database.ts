// ============================================================
// Delícias da Marli — Database Types
// Espelha exatamente o schema SQL do Supabase
// ============================================================

// Enums
export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'unidade'
export type OrderStatus = 'pendente' | 'pago' | 'entregue' | 'cancelado'
export type PaymentMethod = 'pix_manual' | 'dinheiro' | 'cartao' | 'outro'
export type StockMovementType = 'in' | 'out' | 'adjustment'
export type StockMovementReference = 'purchase' | 'order' | 'manual'
export type MemberRole = 'owner' | 'admin' | 'operator' | 'customer'
export type ProfileAccountType = 'business_owner' | 'customer'

// ============================================================
// Tabelas
// ============================================================

export interface Profile {
  id: string
  full_name: string
  email: string | null
  avatar_url: string | null
  account_type: ProfileAccountType | null
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  slug: string | null
  created_at: string
  updated_at: string
}

export interface CompanyMember {
  id: string
  company_id: string
  user_id: string
  role: MemberRole
  created_at: string
  updated_at: string
}

export interface CompanyMemberWithProfile extends CompanyMember {
  profile: Pick<Profile, 'full_name' | 'email' | 'account_type'> | null
}

export type AvailableCustomerProfile = Pick<
  Profile,
  'id' | 'full_name' | 'email' | 'account_type' | 'created_at'
>

export interface Customer {
  id: string
  company_id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  total_spent: number
  total_orders: number
  last_order_at: string | null
  created_at: string
  updated_at: string
}

export interface Ingredient {
  id: string
  company_id: string
  name: string
  unit: Unit
  current_stock: number
  average_cost: number
  min_stock: number
  supplier: string | null
  created_at: string
  updated_at: string
}

export interface IngredientPurchase {
  id: string
  company_id: string
  ingredient_id: string
  quantity: number
  unit_cost: number
  total_cost: number
  supplier: string | null
  notes: string | null
  purchased_at: string
  created_at: string
  updated_at: string
  // Joined fields
  ingredient?: Ingredient
}

export interface Product {
  id: string
  company_id: string
  name: string
  category: string | null
  description: string | null
  sale_price: number
  promotional_price: number | null
  image_url: string | null
  estimated_cost: number
  gross_margin: number
  cmv_percent: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Recipe {
  id: string
  company_id: string
  product_id: string
  yield_quantity: number
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  product?: Product
  recipe_items?: RecipeItem[]
}

export interface RecipeItem {
  id: string
  company_id: string
  recipe_id: string
  ingredient_id: string
  quantity: number
  unit: Unit
  created_at: string
  updated_at: string
  // Joined fields
  ingredient?: Ingredient
}

export interface Order {
  id: string
  company_id: string
  customer_id: string | null
  status: OrderStatus
  payment_method: PaymentMethod | null
  discount: number
  subtotal: number
  total: number
  estimated_cost: number
  estimated_profit: number
  cmv_percent: number
  stock_deducted: boolean
  notes: string | null
  order_date: string
  created_at: string
  updated_at: string
  // Joined fields
  customer?: Customer
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  company_id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
  unit_estimated_cost: number
  total_estimated_cost: number
  created_at: string
  updated_at: string
  // Joined fields
  product?: Product
}

export interface StockMovement {
  id: string
  company_id: string
  ingredient_id: string
  type: StockMovementType
  quantity: number
  reference_type: StockMovementReference | null
  reference_id: string | null
  cost_at_time: number
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  ingredient?: Ingredient
}

export interface Settings {
  id: string
  company_id: string
  key: string
  value: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ============================================================
// Form Data Types (para criar/editar)
// ============================================================

export interface IngredientFormData {
  name: string
  unit: Unit
  current_stock: number
  average_cost: number
  min_stock: number
  supplier: string
}

export interface PurchaseFormData {
  ingredient_id: string
  quantity: number
  unit_cost: number
  supplier: string
  notes: string
  purchased_at: string
}

export interface CustomerFormData {
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

export interface ProductFormData {
  name: string
  category: string
  description: string
  sale_price: number
  is_active: boolean
}

export interface RecipeItemFormData {
  ingredient_id: string
  quantity: number
  unit: Unit
}

export interface RecipeItemWithCost extends RecipeItem {
  ingredient: Ingredient
  item_cost: number
}

export interface RecipeDetails {
  product: Product
  recipe: Recipe
  items: RecipeItemWithCost[]
  ingredients: Ingredient[]
  total_cost: number
  cmv_percent: number
  gross_margin: number
}

export interface RecipeProductSummary {
  product: Product
  recipe_id: string | null
  item_count: number
}

export interface OrderItemFormData {
  product_id: string
  quantity: number
  unit_price: number
}

export interface OrderFormData {
  customer_id: string | null
  payment_method: PaymentMethod | null
  discount: number
  notes: string | null
  order_date: string
  items: OrderItemFormData[]
}

export interface OrderItemWithProduct extends OrderItem {
  product: Product
}

export interface OrderWithDetails extends Omit<Order, 'customer' | 'order_items'> {
  customer: Customer | null
  order_items: OrderItemWithProduct[]
}

export type ReportPeriodPreset = 'today' | '7d' | 'month' | 'custom'

export interface ReportDateRange {
  preset: ReportPeriodPreset
  start_date: string
  end_date: string
  label: string
}

export interface FinancialSummaryReport {
  gross_revenue: number
  discounts: number
  net_revenue: number
  estimated_cost: number
  gross_profit: number
  average_cmv_percent: number
  orders_count: number
  average_ticket: number
}

export interface ProductSalesReport {
  product_id: string
  product_name: string
  quantity_sold: number
  revenue: number
  estimated_cost: number
  gross_profit: number
  cmv_percent: number
}

export interface CustomerRecurringReport {
  customer_id: string
  customer_name: string
  phone: string | null
  total_spent: number
  orders_count: number
  last_order_at: string
  average_ticket: number
}

export interface IngredientConsumptionReport {
  ingredient_id: string
  ingredient_name: string
  quantity_consumed: number
  unit: Unit
  estimated_cost_consumed: number
}

export interface IngredientPurchasesReport {
  ingredient_id: string
  ingredient_name: string
  quantity_purchased: number
  total_purchased: number
  supplier: string | null
  period: string
}

export interface PaymentMethodReport {
  payment_method: PaymentMethod | 'sem_pagamento'
  orders_count: number
  total: number
}

export interface AdminReports {
  range: ReportDateRange
  summary: FinancialSummaryReport
  top_products: ProductSalesReport[]
  recurring_customers: CustomerRecurringReport[]
  ingredient_consumption: IngredientConsumptionReport[]
  ingredient_purchases: IngredientPurchasesReport[]
  payment_methods: PaymentMethodReport[]
}

// ============================================================
// Dashboard Types
// ============================================================

export interface DashboardStats {
  today_sales_count: number
  today_revenue: number
  today_profit: number
  today_cmv: number
  week_sales_count: number
  month_sales_count: number
  month_revenue: number
}

export interface LowStockIngredient {
  id: string
  name: string
  unit: Unit
  current_stock: number
  min_stock: number
}

// ============================================================
// Action Response Types
// ============================================================

export interface ActionResponse<T = void> {
  success: boolean
  data?: T
  error?: string
}
