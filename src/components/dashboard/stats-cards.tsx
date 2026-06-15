import { formatCurrency, formatNumber } from '@/lib/constants'
import type { DashboardStats } from '@/types'
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Percent,
  CalendarDays,
  CalendarRange,
} from 'lucide-react'

interface StatsCardsProps {
  stats: DashboardStats
}

const cards = [
  {
    key: 'today_sales_count' as const,
    title: 'Vendas Hoje',
    icon: ShoppingBag,
    format: (v: number) => v.toString(),
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
  },
  {
    key: 'today_revenue' as const,
    title: 'Faturamento Hoje',
    icon: DollarSign,
    format: formatCurrency,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  {
    key: 'today_profit' as const,
    title: 'Lucro Bruto Hoje',
    icon: TrendingUp,
    format: formatCurrency,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    key: 'today_cmv' as const,
    title: 'CMV Hoje',
    icon: Percent,
    format: (v: number) => `${formatNumber(v)}%`,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    key: 'week_sales_count' as const,
    title: 'Vendas na Semana',
    icon: CalendarDays,
    format: (v: number) => v.toString(),
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
  },
  {
    key: 'month_revenue' as const,
    title: 'Faturamento Mês',
    icon: CalendarRange,
    format: formatCurrency,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
]

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon
        const value = stats[card.key]

        return (
          <div
            key={card.key}
            className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${card.bgColor}`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground truncate">
                  {card.title}
                </p>
                <p className="text-lg font-bold tracking-tight">
                  {card.format(value)}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
