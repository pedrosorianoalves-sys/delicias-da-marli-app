import Link from 'next/link'
import { Plus } from 'lucide-react'

import { getIngredients } from '@/actions/ingredients'
import { ExportButtons } from '@/components/export/export-buttons'
import { IngredientTable } from '@/components/ingredients/ingredient-table'
import { Button } from '@/components/ui/button'
import { ingredientsExportSections } from '@/lib/export-sections'

export default async function IngredientsPage() {
  const ingredients = await getIngredients()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ingredientes</h1>
          <p className="text-sm text-muted-foreground">
            Controle estoque, custo médio e fornecedores.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ExportButtons
            title="Ingredientes"
            sections={ingredientsExportSections(ingredients)}
          />
          <Button render={<Link href="/ingredientes/novo" />}>
            <Plus className="size-4" />
            Novo ingrediente
          </Button>
        </div>
      </div>

      <IngredientTable ingredients={ingredients} />
    </div>
  )
}
