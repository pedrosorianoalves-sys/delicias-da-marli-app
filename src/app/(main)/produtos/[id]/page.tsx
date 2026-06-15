import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BookOpen } from 'lucide-react'

import { getProduct } from '@/actions/products'
import { ProductForm } from '@/components/products/product-form'
import { Button } from '@/components/ui/button'

interface EditProductPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params
  const product = await getProduct(id)

  if (!product) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" render={<Link href="/produtos" />}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
          <Button variant="outline" render={<Link href={`/receitas/${id}`} />}>
            <BookOpen className="size-4" />
            Ficha técnica
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Editar produto</h1>
          <p className="text-sm text-muted-foreground">
            Ajuste cadastro e preço de venda. As métricas vêm da ficha técnica.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <ProductForm product={product} />
      </div>
    </div>
  )
}
