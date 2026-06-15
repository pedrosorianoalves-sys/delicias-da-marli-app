import { getDashboardStats, getLowStockIngredients, getRecentPurchases } from '@/actions/dashboard'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { LowStockAlert } from '@/components/dashboard/low-stock-alert'
import { formatCurrency, formatDate } from '@/lib/constants'
import { ShoppingCart, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const [stats, lowStock, recentPurchases] = await Promise.all([
    getDashboardStats(),
    getLowStockIngredients(),
    getRecentPurchases(),
  ])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Visão geral do seu negócio
        </p>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Grid: Low Stock + Recent Purchases */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low Stock Alert */}
        <LowStockAlert ingredients={lowStock} />

        {/* Recent Purchases */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Compras Recentes</h3>
            </div>
            <Link
              href="/compras"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver todas
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentPurchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma compra registrada ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {recentPurchases.map((purchase) => {
                const ingredient = purchase.ingredient as unknown as { name: string; unit: string } | null
                return (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {ingredient?.name ?? 'Ingrediente'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(purchase.purchased_at)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-600">
                      {formatCurrency(Number(purchase.total_cost))}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
