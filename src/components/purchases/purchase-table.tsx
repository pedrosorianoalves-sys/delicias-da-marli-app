'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Pencil, Search, Trash2 } from 'lucide-react'

import { deletePurchase } from '@/actions/purchases'
import { formatCurrency, formatDate, formatNumber, getUnitAbbrev } from '@/lib/constants'
import { PurchaseForm } from '@/components/purchases/purchase-form'
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
import type { Ingredient, IngredientPurchase } from '@/types'

interface PurchaseTableProps {
  purchases: IngredientPurchase[]
  ingredients: Ingredient[]
}

type PurchaseIngredient = Pick<Ingredient, 'id' | 'name' | 'unit'>

function getPurchaseIngredient(purchase: IngredientPurchase) {
  return purchase.ingredient as PurchaseIngredient | undefined
}

export function PurchaseTable({ purchases, ingredients }: PurchaseTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = purchases.filter((purchase) => {
    const ingredient = getPurchaseIngredient(purchase)
    const query = search.toLowerCase()

    return (
      ingredient?.name.toLowerCase().includes(query) ||
      purchase.supplier?.toLowerCase().includes(query) ||
      purchase.notes?.toLowerCase().includes(query)
    )
  })

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deletePurchase(id)
      setDeletingId(null)

      if (result.success) {
        toast.success('Compra excluída com sucesso!')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erro ao excluir compra.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar compra..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ingrediente</TableHead>
              <TableHead className="hidden sm:table-cell">Data</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="hidden md:table-cell text-right">
                Custo un.
              </TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden lg:table-cell">
                Fornecedor
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  {search
                    ? 'Nenhuma compra encontrada.'
                    : 'Nenhuma compra registrada.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((purchase) => {
                const ingredient = getPurchaseIngredient(purchase)

                return (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">
                      {ingredient?.name ?? 'Ingrediente'}
                      <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                        {formatDate(purchase.purchased_at)}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {formatDate(purchase.purchased_at)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(Number(purchase.quantity), 4)}{' '}
                      {ingredient ? getUnitAbbrev(ingredient.unit) : ''}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {formatCurrency(Number(purchase.unit_cost))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(Number(purchase.total_cost))}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {purchase.supplier ?? '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Dialog
                          open={editingId === purchase.id}
                          onOpenChange={(open) =>
                            setEditingId(open ? purchase.id : null)
                          }
                        >
                          <DialogTrigger
                            render={<Button variant="ghost" size="icon-sm" />}
                          >
                            <Pencil className="size-3.5" />
                            <span className="sr-only">Editar</span>
                          </DialogTrigger>

                          <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Editar compra</DialogTitle>
                              <DialogDescription>
                                Alterar uma compra recalcula estoque e custo
                                médio do ingrediente.
                              </DialogDescription>
                            </DialogHeader>
                            <PurchaseForm
                              ingredients={ingredients}
                              purchase={purchase}
                              onSuccess={() => setEditingId(null)}
                            />
                          </DialogContent>
                        </Dialog>

                        <Dialog
                          open={deletingId === purchase.id}
                          onOpenChange={(open) =>
                            setDeletingId(open ? purchase.id : null)
                          }
                        >
                          <DialogTrigger
                            render={<Button variant="ghost" size="icon-sm" />}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                            <span className="sr-only">Excluir</span>
                          </DialogTrigger>

                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Excluir compra</DialogTitle>
                              <DialogDescription>
                                Esta exclusão remove a entrada de estoque e
                                recalcula o custo médio. A ação não pode ser
                                desfeita.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose render={<Button variant="outline" />}>
                                Cancelar
                              </DialogClose>
                              <Button
                                variant="destructive"
                                disabled={isPending}
                                onClick={() => handleDelete(purchase.id)}
                              >
                                {isPending ? (
                                  <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Excluindo...
                                  </>
                                ) : (
                                  'Excluir'
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
