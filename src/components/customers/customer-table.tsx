'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Mail, Pencil, Phone, Search, Trash2 } from 'lucide-react'

import { deleteCustomer } from '@/actions/customers'
import { formatCurrency, formatDate } from '@/lib/constants'
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
import type { Customer } from '@/types'

interface CustomerTableProps {
  customers: Customer[]
}

export function CustomerTable({ customers }: CustomerTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = customers.filter((customer) => {
    const query = search.toLowerCase()

    return (
      customer.name.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query)
    )
  })

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCustomer(id)
      setDeletingId(null)

      if (result.success) {
        toast.success('Cliente excluído com sucesso!')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erro ao excluir cliente.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone ou email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Contato</TableHead>
              <TableHead className="hidden lg:table-cell">Cadastro</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Compras</TableHead>
              <TableHead className="hidden lg:table-cell">Última compra</TableHead>
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
                    ? 'Nenhum cliente encontrado.'
                    : 'Nenhum cliente cadastrado.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      {customer.name}
                      {customer.total_orders > 1 && (
                        <Badge variant="secondary">Recorrente</Badge>
                      )}
                    </div>
                    {customer.notes && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {customer.notes}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {customer.phone && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="size-3.5" />
                          {customer.phone}
                        </p>
                      )}
                      {customer.email && (
                        <p className="flex items-center gap-1.5">
                          <Mail className="size-3.5" />
                          {customer.email}
                        </p>
                      )}
                      {!customer.phone && !customer.email && '-'}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {formatDate(customer.created_at)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(customer.total_spent)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {customer.total_orders}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {customer.last_order_at
                      ? formatDate(customer.last_order_at)
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<Link href={`/clientes/${customer.id}`} />}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>

                      <Dialog
                        open={deletingId === customer.id}
                        onOpenChange={(open) =>
                          setDeletingId(open ? customer.id : null)
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
                            <DialogTitle>Excluir cliente</DialogTitle>
                            <DialogDescription>
                              Tem certeza que deseja excluir{' '}
                              <strong>{customer.name}</strong>? Esta ação não
                              pode ser desfeita.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <DialogClose render={<Button variant="outline" />}>
                              Cancelar
                            </DialogClose>
                            <Button
                              variant="destructive"
                              disabled={isPending}
                              onClick={() => handleDelete(customer.id)}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
