import Link from 'next/link'
import type { LowStockIngredient } from '@/types'
import { formatNumber, getUnitAbbrev } from '@/lib/constants'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface LowStockAlertProps {
  ingredients: LowStockIngredient[]
}

export function LowStockAlert({ ingredients }: LowStockAlertProps) {
  if (ingredients.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Estoque Baixo</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          ✅ Todos os ingredientes estão com estoque adequado.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h3 className="font-semibold text-amber-900">Estoque Baixo</h3>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">
            {ingredients.length}
          </Badge>
        </div>
        <Link
          href="/ingredientes"
          className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 transition-colors"
        >
          Ver todos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {ingredients.slice(0, 8).map((ingredient) => {
          const percentage = ingredient.min_stock > 0
            ? Math.round((ingredient.current_stock / ingredient.min_stock) * 100)
            : 0

          return (
            <div
              key={ingredient.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/60 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-amber-900 truncate">
                  {ingredient.name}
                </p>
                <p className="text-xs text-amber-700">
                  {formatNumber(ingredient.current_stock)} / {formatNumber(ingredient.min_stock)} {getUnitAbbrev(ingredient.unit)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Mini progress bar */}
                <div className="w-16 h-2 rounded-full bg-amber-200 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all bg-amber-500"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <Badge
                  variant="destructive"
                  className="text-[10px] px-1.5 py-0"
                >
                  {percentage}%
                </Badge>
              </div>
            </div>
          )
        })}
      </div>

      {ingredients.length > 8 && (
        <p className="text-xs text-amber-700 mt-3 text-center">
          e mais {ingredients.length - 8} ingrediente(s)...
        </p>
      )}
    </div>
  )
}
