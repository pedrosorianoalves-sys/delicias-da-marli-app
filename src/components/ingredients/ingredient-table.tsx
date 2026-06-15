'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Pencil, Search, Trash2 } from 'lucide-react'

import { deleteIngredient } from '@/actions/ingredients'
import { formatCurrency, getUnitLabel } from '@/lib/constants'
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
import type { Ingredient } from '@/types'

interface IngredientTableProps {
  ingredients: Ingredient[]
}

export function IngredientTable({ ingredients }: IngredientTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = ingredients.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  )

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteIngredient(id)
      setDeletingId(null)

      if (result.success) {
        toast.success('Ingrediente excluído com sucesso!')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erro ao excluir ingrediente.')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar ingrediente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden sm:table-cell">Unidade</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead className="hidden md:table-cell text-right">
                Custo Médio
              </TableHead>
              <TableHead className="hidden md:table-cell text-right">
                Estoque Mín.
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                Fornecedor
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
                    ? 'Nenhum ingrediente encontrado.'
                    : 'Nenhum ingrediente cadastrado.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((ingredient) => {
                const isLow =
                  ingredient.current_stock < ingredient.min_stock

                return (
                  <TableRow key={ingredient.id}>
                    <TableCell className="font-medium">
                      {ingredient.name}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {getUnitLabel(ingredient.unit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ingredient.current_stock}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {formatCurrency(ingredient.average_cost)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {ingredient.min_stock}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {ingredient.supplier ?? '—'}
                    </TableCell>
                    <TableCell>
                      {isLow ? (
                        <Badge variant="destructive">Baixo</Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          render={
                            <Link
                              href={`/ingredientes/${ingredient.id}`}
                            />
                          }
                        >
                          <Pencil className="size-3.5" />
                          <span className="sr-only">Editar</span>
                        </Button>

                        {/* Delete with confirmation */}
                        <Dialog
                          open={deletingId === ingredient.id}
                          onOpenChange={(open) =>
                            setDeletingId(open ? ingredient.id : null)
                          }
                        >
                          <DialogTrigger
                            render={
                              <Button variant="ghost" size="icon-sm" />
                            }
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                            <span className="sr-only">Excluir</span>
                          </DialogTrigger>

                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Excluir ingrediente</DialogTitle>
                              <DialogDescription>
                                Só é possível excluir{' '}
                                <strong>{ingredient.name}</strong> se ele não
                                tiver compras, movimentações de estoque ou uso
                                em fichas técnicas. Esta ação não pode ser
                                desfeita.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose
                                render={<Button variant="outline" />}
                              >
                                Cancelar
                              </DialogClose>
                              <Button
                                variant="destructive"
                                disabled={isPending}
                                onClick={() => handleDelete(ingredient.id)}
                              >
                                {isPending ? (
                                  <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Excluindo…
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
