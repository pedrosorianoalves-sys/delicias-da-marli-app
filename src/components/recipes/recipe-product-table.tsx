'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'

import { formatCurrency, formatNumber } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RecipeProductSummary } from '@/types'

interface RecipeProductTableProps {
  summaries: RecipeProductSummary[]
}

export function RecipeProductTable({ summaries }: RecipeProductTableProps) {
  const [search, setSearch] = useState('')

  const filtered = summaries.filter(({ product }) => {
    const query = search.toLowerCase()
    return (
      product.name.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="hidden md:table-cell">Itens</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="hidden md:table-cell text-right">
                CMV
              </TableHead>
              <TableHead className="hidden lg:table-cell text-right">
                Lucro
              </TableHead>
              <TableHead className="text-right">Ficha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  {search
                    ? 'Nenhum produto encontrado.'
                    : 'Nenhum produto cadastrado.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(({ product, item_count }) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    {product.name}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {product.category ?? 'Sem categoria'}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={item_count > 0 ? 'secondary' : 'outline'}>
                      {item_count} item(ns)
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(product.estimated_cost)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums">
                    {formatNumber(product.cmv_percent)}%
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right tabular-nums">
                    {formatCurrency(product.gross_margin)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      render={<Link href={`/receitas/${product.id}`} />}
                    >
                      Abrir
                      <ArrowRight className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
