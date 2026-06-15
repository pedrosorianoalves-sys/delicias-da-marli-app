'use server'

import { createClient } from '@/lib/supabase/server'
import { requireCompanyRole } from '@/lib/auth/permissions'
import type { DashboardStats, LowStockIngredient } from '@/types'

async function getCompanyId(): Promise<string | null> {
  const result = await requireCompanyRole()
  if ('error' in result) return null
  return result.companyId
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const companyId = await getCompanyId()
  if (!companyId) {
    return {
      today_sales_count: 0,
      today_revenue: 0,
      today_profit: 0,
      today_cmv: 0,
      week_sales_count: 0,
      month_sales_count: 0,
      month_revenue: 0,
    }
  }

  const supabase = await createClient()

  // Get today's date range in UTC
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

  // Week start (Monday)
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset).toISOString()

  // Month start
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Today's orders (paid or delivered)
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('total, estimated_cost, estimated_profit')
    .eq('company_id', companyId)
    .in('status', ['pago', 'entregue'])
    .gte('order_date', todayStart)
    .lt('order_date', todayEnd)

  const todaySalesCount = todayOrders?.length ?? 0
  const todayRevenue = todayOrders?.reduce((sum, o) => sum + Number(o.total), 0) ?? 0
  const todayProfit = todayOrders?.reduce((sum, o) => sum + Number(o.estimated_profit), 0) ?? 0
  const todayCost = todayOrders?.reduce((sum, o) => sum + Number(o.estimated_cost), 0) ?? 0
  const todayCmv = todayRevenue > 0 ? (todayCost / todayRevenue) * 100 : 0

  // Week orders
  const { count: weekSalesCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .in('status', ['pago', 'entregue'])
    .gte('order_date', weekStart)

  // Month orders
  const { data: monthOrders } = await supabase
    .from('orders')
    .select('total')
    .eq('company_id', companyId)
    .in('status', ['pago', 'entregue'])
    .gte('order_date', monthStart)

  const monthSalesCount = monthOrders?.length ?? 0
  const monthRevenue = monthOrders?.reduce((sum, o) => sum + Number(o.total), 0) ?? 0

  return {
    today_sales_count: todaySalesCount,
    today_revenue: todayRevenue,
    today_profit: todayProfit,
    today_cmv: Math.round(todayCmv * 100) / 100,
    week_sales_count: weekSalesCount ?? 0,
    month_sales_count: monthSalesCount,
    month_revenue: monthRevenue,
  }
}

export async function getLowStockIngredients(): Promise<LowStockIngredient[]> {
  const companyId = await getCompanyId()
  if (!companyId) return []

  const supabase = await createClient()

  const { data } = await supabase
    .from('ingredients')
    .select('id, name, unit, current_stock, min_stock')
    .eq('company_id', companyId)
    .gt('min_stock', 0)
    .order('name')

  if (!data) return []

  // Filter on client side since Supabase doesn't support column-to-column comparison in .lt()
  return data.filter(
    (i) => Number(i.current_stock) < Number(i.min_stock)
  ) as LowStockIngredient[]
}

export async function getRecentPurchases() {
  const companyId = await getCompanyId()
  if (!companyId) return []

  const supabase = await createClient()

  const { data } = await supabase
    .from('ingredient_purchases')
    .select('id, quantity, total_cost, purchased_at, ingredient:ingredients(name, unit)')
    .eq('company_id', companyId)
    .order('purchased_at', { ascending: false })
    .limit(5)

  return data ?? []
}
