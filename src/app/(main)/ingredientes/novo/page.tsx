import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { IngredientForm } from '@/components/ingredients/ingredient-form'
import { Button } from '@/components/ui/button'

export default function NewIngredientPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" render={<Link href="/ingredientes" />}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Novo ingrediente
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre um item de estoque usado na produção.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <IngredientForm />
      </div>
    </div>
  )
}
