'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { addRecipeItem, updateRecipeItem } from '@/actions/recipes'
import {
  calculateIngredientCost,
  getCompatibleUnits,
} from '@/lib/product-costing'
import { formatCurrency, getUnitAbbrev, UNITS } from '@/lib/constants'
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
import type { ActionResponse, Ingredient, RecipeItemWithCost, Unit } from '@/types'

interface RecipeItemFormProps {
  productId: string
  ingredients: Ingredient[]
  item?: RecipeItemWithCost
  onSuccess?: () => void
}

const initialState: ActionResponse = { success: false }

function unitLabel(unit: Unit) {
  return UNITS.find((item) => item.value === unit)?.label ?? unit
}

export function RecipeItemForm({
  productId,
  ingredients,
  item,
  onSuccess,
}: RecipeItemFormProps) {
  const isEditing = !!item
  const [ingredientId, setIngredientId] = useState(
    item?.ingredient_id ?? ingredients[0]?.id ?? '',
  )
  const selectedIngredient = ingredients.find(
    (ingredient) => ingredient.id === ingredientId,
  )
  const [unit, setUnit] = useState<Unit>(
    item?.unit ?? selectedIngredient?.unit ?? 'g',
  )
  const [quantity, setQuantity] = useState(String(item?.quantity ?? ''))

  const compatibleUnits = selectedIngredient
    ? getCompatibleUnits(selectedIngredient.unit)
    : []

  const parsedQuantity = Number(quantity)
  const previewCost =
    selectedIngredient &&
    !Number.isNaN(parsedQuantity) &&
    parsedQuantity > 0
      ? calculateIngredientCost(selectedIngredient, parsedQuantity, unit)
      : null

  function handleIngredientChange(value: string | null) {
    if (!value) return

    const nextIngredient = ingredients.find(
      (ingredient) => ingredient.id === value,
    )

    setIngredientId(value)
    if (nextIngredient) setUnit(nextIngredient.unit)
  }

  async function handleAction(
    _prev: ActionResponse,
    formData: FormData,
  ): Promise<ActionResponse> {
    formData.set('ingredient_id', ingredientId)
    formData.set('unit', unit)

    const result = isEditing
      ? await updateRecipeItem(item.id, productId, formData)
      : await addRecipeItem(productId, formData)

    if (result.success) {
      toast.success(
        isEditing
          ? 'Ingrediente atualizado na ficha!'
          : 'Ingrediente adicionado à ficha!',
      )
      onSuccess?.()
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
          onValueChange={handleIngredientChange}
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
          <Label>Unidade usada *</Label>
          <Select
            value={unit}
            onValueChange={(value) => {
              if (value) setUnit(value as Unit)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              {compatibleUnits.map((compatibleUnit) => (
                <SelectItem key={compatibleUnit} value={compatibleUnit}>
                  {unitLabel(compatibleUnit)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="unit" value={unit} />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Custo estimado: </span>
        <strong>
          {previewCost === null ? '-' : formatCurrency(previewCost)}
        </strong>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending || ingredients.length === 0}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Salvando...
            </>
          ) : isEditing ? (
            'Atualizar ingrediente'
          ) : (
            'Adicionar ingrediente'
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
