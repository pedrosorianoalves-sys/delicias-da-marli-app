'use client'

import { useState } from 'react'
import { Check, Plus } from 'lucide-react'

import type { PublicCatalogProduct } from '@/actions/public-catalog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/constants'

interface PublicCatalogProps {
  products: PublicCatalogProduct[]
}

export function PublicCatalog({ products }: PublicCatalogProps) {
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  function handleAdd(productId: string) {
    setAddedIds((current) => {
      const next = new Set(current)
      next.add(productId)
      return next
    })
  }

  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-rose-100 bg-white/80 px-6 py-12 text-center shadow-sm">
        <p className="text-sm font-medium text-rose-950">Catálogo em preparação</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Em breve os produtos estarão disponíveis por aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const promotionalPrice =
          product.promotional_price !== null &&
          product.promotional_price > 0 &&
          product.promotional_price < product.sale_price
            ? product.promotional_price
            : null
        const added = addedIds.has(product.id)

        return (
          <article
            key={product.id}
            className="group overflow-hidden rounded-lg border border-rose-100 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-rose-50">
              {product.image_url ? (
                <div
                  aria-label={product.name}
                  role="img"
                  className="h-full bg-cover bg-center transition duration-300 group-hover:scale-[1.03]"
                  style={{ backgroundImage: `url(${product.image_url})` }}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#fff7ed_0,#ffe4e6_35%,#fce7f3_100%)]">
                  <div className="flex size-20 items-center justify-center rounded-full bg-white/80 text-3xl font-semibold text-rose-700 shadow-sm">
                    {product.name.slice(0, 1).toUpperCase()}
                  </div>
                </div>
              )}

              {promotionalPrice && (
                <Badge className="absolute left-3 top-3 bg-rose-600 text-white">
                  Promoção
                </Badge>
              )}
            </div>

            <div className="space-y-4 p-4">
              <div className="space-y-1">
                {product.category && (
                  <p className="text-xs font-medium uppercase text-rose-600">
                    {product.category}
                  </p>
                )}
                <h2 className="line-clamp-2 text-base font-semibold text-rose-950">
                  {product.name}
                </h2>
                {product.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {product.description}
                  </p>
                )}
              </div>

              <div className="flex items-end justify-between gap-3">
                <div>
                  {promotionalPrice ? (
                    <>
                      <p className="text-xs text-muted-foreground line-through">
                        {formatCurrency(product.sale_price)}
                      </p>
                      <p className="text-lg font-bold text-rose-700">
                        {formatCurrency(promotionalPrice)}
                      </p>
                    </>
                  ) : (
                    <p className="text-lg font-bold text-rose-950">
                      {formatCurrency(product.sale_price)}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleAdd(product.id)}
                  className="bg-rose-600 text-white hover:bg-rose-700"
                >
                  {added ? (
                    <>
                      <Check className="size-3.5" />
                      Adicionado
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5" />
                      Adicionar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
