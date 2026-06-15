import { getRecipeProductSummaries } from '@/actions/recipes'
import { RecipeProductTable } from '@/components/recipes/recipe-product-table'

export default async function RecipesPage() {
  const summaries = await getRecipeProductSummaries()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Receitas</h1>
        <p className="text-sm text-muted-foreground">
          Abra a ficha técnica de cada produto para calcular custo, CMV e lucro.
        </p>
      </div>

      <RecipeProductTable summaries={summaries} />
    </div>
  )
}
