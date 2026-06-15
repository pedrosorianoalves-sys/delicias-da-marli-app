'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { createCustomer, updateCustomer } from '@/actions/customers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ActionResponse, Customer } from '@/types'

interface CustomerFormProps {
  customer?: Customer
}

const initialState: ActionResponse = { success: false }

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter()
  const isEditing = !!customer

  async function handleAction(
    _prev: ActionResponse,
    formData: FormData,
  ): Promise<ActionResponse> {
    const result = isEditing
      ? await updateCustomer(customer.id, formData)
      : await createCustomer(formData)

    if (result.success) {
      toast.success(
        isEditing
          ? 'Cliente atualizado com sucesso!'
          : 'Cliente criado com sucesso!',
      )
      router.push('/clientes')
    } else {
      toast.error(result.error ?? 'Erro inesperado.')
    }

    return result
  }

  const [, formAction, isPending] = useActionState(handleAction, initialState)

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ex: Ana Paula"
          defaultValue={customer?.name ?? ''}
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone/WhatsApp</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="(11) 99999-9999"
            defaultValue={customer?.phone ?? ''}
            autoComplete="tel"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="cliente@email.com"
            defaultValue={customer?.email ?? ''}
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Endereço</Label>
        <Input
          id="address"
          name="address"
          placeholder="Rua, número, bairro, cidade"
          defaultValue={customer?.address ?? ''}
          autoComplete="street-address"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Preferências, restrições, horários de entrega..."
          defaultValue={customer?.notes ?? ''}
        />
      </div>

      {customer && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Total comprado</p>
            <p className="font-semibold">R$ {customer.total_spent.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Compras</p>
            <p className="font-semibold">{customer.total_orders}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Última compra</p>
            <p className="font-semibold">
              {customer.last_order_at ? 'Registrada' : '-'}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending} className="min-w-32">
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Salvando...
            </>
          ) : isEditing ? (
            'Atualizar'
          ) : (
            'Criar cliente'
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/clientes')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
