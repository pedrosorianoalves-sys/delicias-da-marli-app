import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'

import { getRecipeDetails } from '@/actions/recipes'
import { RecipeEditor } from '@/components/recipes/recipe-editor'
import { Button } from '@/components/ui/button'

interface RecipePageProps {
  params: Promise<{
    product_id: string
  }>
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { product_id: productId } = await params
  const details = await getRecipeDetails(productId)

  if (!details) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" render={<Link href="/receitas" />}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
          <Button variant="outline" render={<Link href={`/produtos/${productId}`} />}>
            <Pencil className="size-4" />
            Editar produto
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {details.product.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ficha técnica e custo estimado por unidade vendida.
          </p>
        </div>
      </div>

      <RecipeEditor details={details} />
    </div>
  )
}
