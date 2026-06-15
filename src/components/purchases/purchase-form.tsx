'use client'

import { useActionState, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { createPurchase, updatePurchase } from '@/actions/purchases'
import { formatCurrency, getUnitAbbrev } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ActionResponse, Ingredient, IngredientPurchase } from '@/types'

interface PurchaseFormProps {
  ingredients: Ingredient[]
  purchase?: IngredientPurchase
  onSuccess?: () => void
}

const initialState: ActionResponse = { success: false }

function toDateInputValue(value?: string) {
  if (!value) return new Date().toISOString().split('T')[0]
  return new Date(value).toISOString().split('T')[0]
}

export function PurchaseForm({
  ingredients,
  purchase,
  onSuccess,
}: PurchaseFormProps) {
  const router = useRouter()
  const isEditing = !!purchase
  const [ingredientId, setIngredientId] = useState(
    purchase?.ingredient_id ?? ingredients[0]?.id ?? '',
  )
  const [quantity, setQuantity] = useState(String(purchase?.quantity ?? ''))
  const [unitCost, setUnitCost] = useState(String(purchase?.unit_cost ?? ''))

  const selectedIngredient = ingredients.find(
    (ingredient) => ingredient.id === ingredientId,
  )

  const total = useMemo(() => {
    const parsedQuantity = Number(quantity)
    const parsedUnitCost = Number(unitCost)

    if (
      Number.isNaN(parsedQuantity) ||
      Number.isNaN(parsedUnitCost) ||
      parsedQuantity <= 0 ||
      parsedUnitCost < 0
    ) {
      return 0
    }

    return parsedQuantity * parsedUnitCost
  }, [quantity, unitCost])

  async function handleAction(
    _prev: ActionResponse,
    formData: FormData,
  ): Promise<ActionResponse> {
    formData.set('ingredient_id', ingredientId)

    const result = isEditing
      ? await updatePurchase(purchase.id, formData)
      : await createPurchase(formData)

    if (result.success) {
      toast.success(
        isEditing
          ? 'Compra atualizada com sucesso!'
          : 'Compra registrada com sucesso!',
      )
      onSuccess?.()
      router.refresh()
    } else {
      toast.error(result.error ?? 'Erro inesperado.')
    }

    return result
  }

  const [, formAction, isPending] = useActionState(handleAction, initialState)

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label>Ingrediente *</Label>
        <Select
          value={ingredientId}
          onValueChange={(value) => {
            if (value) setIngredientId(value)
          }}
          disabled={ingredients.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione o ingrediente" />
          </SelectTrigger>
          <SelectContent>
            {ingredients.map((ingredient) => (
              <SelectItem key={ingredient.id} value={ingredient.id}>
                {ingredient.name} ({getUnitAbbrev(ingredient.unit)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="ingredient_id" value={ingredientId} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantidade *</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={0.0001}
            step="0.0001"
            placeholder="0"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit_cost">Custo unitário *</Label>
          <Input
            id="unit_cost"
            name="unit_cost"
            type="number"
            min={0}
            step="0.0001"
            placeholder="0,00"
            required
            value={unitCost}
            onChange={(event) => setUnitCost(event.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Total da compra: </span>
        <strong>{formatCurrency(total)}</strong>
        {selectedIngredient && (
          <span className="ml-2 text-muted-foreground">
            em {getUnitAbbrev(selectedIngredient.unit)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="supplier">Fornecedor</Label>
          <Input
            id="supplier"
            name="supplier"
            placeholder="Ex: Atacado Central"
            defaultValue={purchase?.supplier ?? ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchased_at">Data da compra</Label>
          <Input
            id="purchased_at"
            name="purchased_at"
            type="date"
            defaultValue={toDateInputValue(purchase?.purchased_at)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Lote, nota fiscal, condição de pagamento..."
          defaultValue={purchase?.notes ?? ''}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending || ingredients.length === 0}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Salvando...
            </>
          ) : isEditing ? (
            'Atualizar compra'
          ) : (
            'Registrar compra'
          )}
        </Button>

        {onSuccess && (
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
