'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  BookOpen,
  Loader2,
  Pencil,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from 'lucide-react'

import { deleteProduct, setProductActive } from '@/actions/products'
import { formatCurrency, formatNumber } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Product } from '@/types'

interface ProductTableProps {
  products: Product[]
}

export function ProductTable({ products }: ProductTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [activeDialogId, setActiveDialogId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = products.filter((product) => {
    const query = search.toLowerCase()

    return (
      product.name.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query)
    )
  })

  function handleSetActive(product: Product, isActive: boolean) {
    startTransition(async () => {
      const result = await setProductActive(product.id, isActive)
      setActiveDialogId(null)

      if (result.success) {
        toast.success(isActive ? 'Produto ativado!' : 'Produto inativado!')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erro ao atualizar produto.')
      }
    })
  }

  function handleDelete(product: Product) {
    startTransition(async () => {
      const result = await deleteProduct(product.id)
      setDeletingId(null)

      if (result.success) {
        toast.success('Produto excluído definitivamente.')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erro ao excluir produto.')
      }
    })
  }

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
              <TableHead className="hidden md:table-cell">Categoria</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="hidden md:table-cell text-right">
                Custo
              </TableHead>
              <TableHead className="hidden lg:table-cell text-right">
                CMV
              </TableHead>
              <TableHead className="hidden lg:table-cell text-right">
                Lucro
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  {search
                    ? 'Nenhum produto encontrado.'
                    : 'Nenhum produto cadastrado.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    {product.name}
                    {product.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {product.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {product.category ?? '-'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(product.sale_price)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums">
                    {formatCurrency(product.estimated_cost)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right tabular-nums">
                    {formatNumber(product.cmv_percent)}%
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right tabular-nums">
                    {formatCurrency(product.gross_margin)}
                  </TableCell>
                  <TableCell>
                    {product.is_active ? (
                      <Badge variant="secondary">Ativo</Badge>
                    ) : (
                      <Badge variant="outline">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<Link href={`/receitas/${product.id}`} />}
                      >
                        <BookOpen className="size-3.5" />
                        <span className="sr-only">Ficha técnica</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<Link href={`/produtos/${product.id}`} />}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>

                      <Dialog
                        open={activeDialogId === product.id}
                        onOpenChange={(open) =>
                          setActiveDialogId(open ? product.id : null)
                        }
                      >
                        <DialogTrigger
                          render={<Button variant="ghost" size="icon-sm" />}
                        >
                          {product.is_active ? (
                            <ToggleRight className="size-4 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="size-4 text-muted-foreground" />
                          )}
                          <span className="sr-only">
                            {product.is_active ? 'Inativar' : 'Ativar'}
                          </span>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              {product.is_active
                                ? 'Inativar produto'
                                : 'Ativar produto'}
                            </DialogTitle>
                            <DialogDescription>
                              {product.is_active
                                ? 'O produto sai das listas ativas, mas a ficha técnica e histórico permanecem.'
                                : 'O produto volta para as listas ativas.'}
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <DialogClose render={<Button variant="outline" />}>
                              Cancelar
                            </DialogClose>
                            <Button
                              disabled={isPending}
                              onClick={() =>
                                handleSetActive(product, !product.is_active)
                              }
                            >
                              {isPending ? (
                                <>
                                  <Loader2 className="size-4 animate-spin" />
                                  Salvando...
                                </>
                              ) : product.is_active ? (
                                'Inativar'
                              ) : (
                                'Ativar'
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog
                        open={deletingId === product.id}
                        onOpenChange={(open) =>
                          setDeletingId(open ? product.id : null)
                        }
                      >
                        <DialogTrigger
                          render={<Button variant="ghost" size="icon-sm" />}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                          <span className="sr-only">Excluir definitivamente</span>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Excluir produto definitivamente</DialogTitle>
                            <DialogDescription>
                              Só é possível excluir produtos sem histórico de
                              pedidos. A ficha técnica será removida junto, se
                              existir. Se houver histórico, inative o produto.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <DialogClose render={<Button variant="outline" />}>
                              Cancelar
                            </DialogClose>
                            <Button
                              variant="destructive"
                              disabled={isPending}
                              onClick={() => handleDelete(product)}
                            >
                              {isPending ? (
                                <>
                                  <Loader2 className="size-4 animate-spin" />
                                  Excluindo...
                                </>
                              ) : (
                                'Excluir definitivamente'
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
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
