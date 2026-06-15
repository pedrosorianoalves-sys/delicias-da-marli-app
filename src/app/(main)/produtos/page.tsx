import Link from 'next/link'
import { Plus } from 'lucide-react'

import { getProducts } from '@/actions/products'
import { ExportButtons } from '@/components/export/export-buttons'
import { ProductTable } from '@/components/products/product-table'
import { Button } from '@/components/ui/button'
import { productsExportSections } from '@/lib/export-sections'

export default async function ProductsPage() {
  const products = await getProducts()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre produtos e acompanhe custo, CMV e lucro estimado.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ExportButtons
            title="Produtos"
            sections={productsExportSections(products)}
          />
          <Button render={<Link href="/produtos/novo" />}>
            <Plus className="size-4" />
            Novo produto
          </Button>
        </div>
      </div>

      <ProductTable products={products} />
    </div>
  )
}
