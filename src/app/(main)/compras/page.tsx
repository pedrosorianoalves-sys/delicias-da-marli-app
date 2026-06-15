import { ShoppingCart } from 'lucide-react'

import { getIngredients } from '@/actions/ingredients'
import { getPurchases } from '@/actions/purchases'
import { ExportButtons } from '@/components/export/export-buttons'
import { PurchaseCreateDialog } from '@/components/purchases/purchase-create-dialog'
import { PurchaseTable } from '@/components/purchases/purchase-table'
import { purchasesExportSections } from '@/lib/export-sections'

export default async function PurchasesPage() {
  const [purchases, ingredients] = await Promise.all([
    getPurchases(),
    getIngredients(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compras</h1>
          <p className="text-sm text-muted-foreground">
            Registre entradas de estoque e acompanhe o custo médio.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ExportButtons
            title="Compras"
            sections={purchasesExportSections(purchases)}
          />
          <PurchaseCreateDialog ingredients={ingredients} />
        </div>
      </div>

      {ingredients.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <ShoppingCart className="mx-auto mb-3 size-8 text-muted-foreground" />
          <h2 className="font-semibold">Cadastre ingredientes primeiro</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Compras precisam estar vinculadas a um ingrediente de estoque.
          </p>
        </div>
      ) : (
        <PurchaseTable purchases={purchases} ingredients={ingredients} />
      )}
    </div>
  )
}
