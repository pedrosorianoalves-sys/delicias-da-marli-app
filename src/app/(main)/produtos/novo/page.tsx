import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { ProductForm } from '@/components/products/product-form'
import { Button } from '@/components/ui/button'

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" render={<Link href="/produtos" />}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo produto</h1>
          <p className="text-sm text-muted-foreground">
            A ficha técnica será criada automaticamente.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <ProductForm />
      </div>
    </div>
  )
}
