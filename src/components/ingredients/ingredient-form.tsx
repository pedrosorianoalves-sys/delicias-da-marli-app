'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { createIngredient, updateIngredient } from '@/actions/ingredients'
import { UNITS } from '@/lib/constants'
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
import type { ActionResponse, Ingredient, Unit } from '@/types'

interface IngredientFormProps {
  ingredient?: Ingredient
  onSuccess?: () => void
}

const initialState: ActionResponse = { success: false }

export function IngredientForm({ ingredient, onSuccess }: IngredientFormProps) {
  const router = useRouter()
  const isEditing = !!ingredient
  const [unit, setUnit] = useState<Unit>(ingredient?.unit ?? 'g')

  async function handleAction(
    _prev: ActionResponse,
    formData: FormData,
  ): Promise<ActionResponse> {
    // Inject unit from select state into FormData
    formData.set('unit', unit)

    const result = isEditing
      ? await updateIngredient(ingredient.id, formData)
      : await createIngredient(formData)

    if (result.success) {
      toast.success(
        isEditing
          ? 'Ingrediente atualizado com sucesso!'
          : 'Ingrediente criado com sucesso!',
      )
      onSuccess?.()
      router.push('/ingredientes')
    } else {
      toast.error(result.error ?? 'Erro inesperado.')
    }

    return result
  }

  const [, formAction, isPending] = useActionState(handleAction, initialState)

  return (
    <form action={formAction} className="space-y-6">
      {/* Nome */}
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ex: Leite condensado"
          defaultValue={ingredient?.name ?? ''}
          required
          autoFocus
        />
      </div>

      {/* Unidade */}
      <div className="space-y-2">
        <Label>Unidade *</Label>
        <Select value={unit} onValueChange={(val) => setUnit(val as Unit)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Hidden input so the value goes through FormData even if JS fails */}
        <input type="hidden" name="unit" value={unit} />
      </div>

      {/* Estoque Atual + Custo Médio */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="current_stock">Estoque Atual</Label>
          <Input
            id="current_stock"
            name="current_stock"
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            defaultValue={ingredient?.current_stock ?? 0}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="average_cost">Custo Médio (R$)</Label>
          <Input
            id="average_cost"
            name="average_cost"
            type="number"
            min={0}
            step="0.01"
            placeholder="0,00"
            defaultValue={ingredient?.average_cost ?? 0}
          />
        </div>
      </div>

      {/* Estoque Mínimo */}
      <div className="space-y-2">
        <Label htmlFor="min_stock">Estoque Mínimo</Label>
        <Input
          id="min_stock"
          name="min_stock"
          type="number"
          min={0}
          step="0.01"
          placeholder="0"
          defaultValue={ingredient?.min_stock ?? 0}
        />
      </div>

      {/* Fornecedor */}
      <div className="space-y-2">
        <Label htmlFor="supplier">Fornecedor</Label>
        <Input
          id="supplier"
          name="supplier"
          placeholder="Ex: Distribuidora XYZ"
          defaultValue={ingredient?.supplier ?? ''}
        />
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending} className="min-w-32">
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Salvando…
            </>
          ) : isEditing ? (
            'Atualizar'
          ) : (
            'Criar Ingrediente'
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/ingredientes')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
