import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getIngredient } from '@/actions/ingredients'
import { IngredientForm } from '@/components/ingredients/ingredient-form'
import { Button } from '@/components/ui/button'

interface EditIngredientPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditIngredientPage({
  params,
}: EditIngredientPageProps) {
  const { id } = await params
  const ingredient = await getIngredient(id)

  if (!ingredient) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" render={<Link href="/ingredientes" />}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Editar ingrediente
          </h1>
          <p className="text-sm text-muted-foreground">
            Ajuste cadastro, estoque mínimo e dados de fornecedor.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <IngredientForm ingredient={ingredient} />
      </div>
    </div>
  )
}
