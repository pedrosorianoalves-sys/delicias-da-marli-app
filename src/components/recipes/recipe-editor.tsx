'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

import { clearProductRecipe, deleteRecipeItem } from '@/actions/recipes'
import { formatCurrency, formatNumber, getUnitAbbrev } from '@/lib/constants'
import { RecipeItemForm } from '@/components/recipes/recipe-item-form'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RecipeDetails } from '@/types'

interface RecipeEditorProps {
  details: RecipeDetails
}

export function RecipeEditor({ details }: RecipeEditorProps) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(itemId: string) {
    startTransition(async () => {
      const result = await deleteRecipeItem(itemId, details.product.id)
      setDeletingId(null)

      if (result.success) {
        toast.success('Ingrediente removido da ficha!')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erro ao remover ingrediente.')
      }
    })
  }

  function handleClearRecipe() {
    startTransition(async () => {
      const result = await clearProductRecipe(details.product.id)
      setClearOpen(false)

      if (result.success) {
        toast.success('Ficha técnica limpa. Custos recalculados.')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erro ao limpar ficha técnica.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Preço de venda</p>
          <p className="text-xl font-bold">
            {formatCurrency(details.product.sale_price)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Custo total</p>
          <p className="text-xl font-bold">
            {formatCurrency(details.total_cost)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">CMV</p>
          <p className="text-xl font-bold">
            {formatNumber(details.cmv_percent)}%
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Lucro bruto</p>
          <p className="text-xl font-bold">
            {formatCurrency(details.gross_margin)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Ingredientes da ficha</h2>
          <p className="text-sm text-muted-foreground">
            Custo calculado com o custo médio de cada ingrediente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={clearOpen} onOpenChange={setClearOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  disabled={details.items.length === 0}
                />
              }
            >
              <Trash2 className="size-4 text-destructive" />
              Limpar ficha
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Limpar ficha técnica</DialogTitle>
                <DialogDescription>
                  Todos os ingredientes da ficha serão removidos e o custo,
                  CMV e lucro do produto serão recalculados. Esta ação não
                  apaga o produto.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancelar
                </DialogClose>
                <Button
                  variant="destructive"
                  disabled={isPending}
                  onClick={handleClearRecipe}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Limpando...
                    </>
                  ) : (
                    'Limpar ficha'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger
              render={<Button disabled={details.ingredients.length === 0} />}
            >
              <Plus className="size-4" />
              Adicionar
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Adicionar ingrediente</DialogTitle>
                <DialogDescription>
                  Escolha a quantidade usada para este produto.
                </DialogDescription>
              </DialogHeader>
              <RecipeItemForm
                productId={details.product.id}
                ingredients={details.ingredients}
                onSuccess={() => {
                  setAddOpen(false)
                  router.refresh()
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {details.ingredients.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <h3 className="font-semibold">Cadastre ingredientes primeiro</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            A ficha técnica depende dos ingredientes já cadastrados.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingrediente</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  Custo médio
                </TableHead>
                <TableHead className="text-right">Custo item</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Nenhum ingrediente adicionado.
                  </TableCell>
                </TableRow>
              ) : (
                details.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.ingredient.name}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        base: {getUnitAbbrev(item.ingredient.unit)}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(
                        Number(item.quantity),
                        item.unit === 'unidade' ? 0 : 2,
                      )}{' '}
                      {getUnitAbbrev(item.unit)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {formatCurrency(item.ingredient.average_cost)} /{' '}
                      {getUnitAbbrev(item.ingredient.unit)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(item.item_cost)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Dialog
                          open={editingId === item.id}
                          onOpenChange={(open) =>
                            setEditingId(open ? item.id : null)
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
                              <DialogTitle>Editar ingrediente</DialogTitle>
                              <DialogDescription>
                                Ajuste quantidade ou unidade usada.
                              </DialogDescription>
                            </DialogHeader>
                            <RecipeItemForm
                              productId={details.product.id}
                              ingredients={details.ingredients}
                              item={item}
                              onSuccess={() => {
                                setEditingId(null)
                                router.refresh()
                              }}
                            />
                          </DialogContent>
                        </Dialog>

                        <Dialog
                          open={deletingId === item.id}
                          onOpenChange={(open) =>
                            setDeletingId(open ? item.id : null)
                          }
                        >
                          <DialogTrigger
                            render={<Button variant="ghost" size="icon-sm" />}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                            <span className="sr-only">Remover</span>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Remover ingrediente</DialogTitle>
                              <DialogDescription>
                                Remover este item recalcula o custo, CMV e
                                lucro do produto.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose render={<Button variant="outline" />}>
                                Cancelar
                              </DialogClose>
                              <Button
                                variant="destructive"
                                disabled={isPending}
                                onClick={() => handleDelete(item.id)}
                              >
                                {isPending ? (
                                  <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Removendo...
                                  </>
                                ) : (
                                  'Remover'
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
      )}
    </div>
  )
}
