'use server'

import { createClient } from '@/lib/supabase/server'
import { requireCompanyRole } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import type { ActionResponse, Ingredient, Unit } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UNITS: Unit[] = ['g', 'kg', 'ml', 'l', 'unidade']

async function getCompanyId(): Promise<
  { companyId: string; userId: string } | { error: string }
> {
  const result = await requireCompanyRole()
  if ('error' in result) return { error: result.error }
  return { companyId: result.companyId, userId: result.userId }
}

function parseIngredientForm(formData: FormData) {
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const unit = (formData.get('unit') as string | null) ?? ''
  const currentStock = Number(formData.get('current_stock') ?? 0)
  const averageCost = Number(formData.get('average_cost') ?? 0)
  const minStock = Number(formData.get('min_stock') ?? 0)
  const supplier = (formData.get('supplier') as string | null)?.trim() || null

  // Validation
  const errors: string[] = []
  if (!name) errors.push('Nome é obrigatório.')
  if (!VALID_UNITS.includes(unit as Unit)) errors.push('Unidade inválida.')
  if (isNaN(currentStock) || currentStock < 0)
    errors.push('Estoque atual deve ser >= 0.')
  if (isNaN(averageCost) || averageCost < 0)
    errors.push('Custo médio deve ser >= 0.')
  if (isNaN(minStock) || minStock < 0)
    errors.push('Estoque mínimo deve ser >= 0.')

  if (errors.length > 0) {
    return { valid: false as const, error: errors.join(' ') }
  }

  return {
    valid: true as const,
    data: {
      name,
      unit: unit as Unit,
      current_stock: currentStock,
      average_cost: averageCost,
      min_stock: minStock,
      supplier,
    },
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getIngredients(): Promise<Ingredient[]> {
  const result = await getCompanyId()
  if ('error' in result) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('company_id', result.companyId)
    .order('name')

  if (error) {
    console.error('getIngredients error:', error.message)
    return []
  }

  return (data ?? []) as Ingredient[]
}

export async function getIngredient(id: string): Promise<Ingredient | null> {
  const result = await getCompanyId()
  if ('error' in result) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('id', id)
    .eq('company_id', result.companyId)
    .single()

  if (error) return null

  return data as Ingredient
}

export async function createIngredient(
  formData: FormData,
): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const parsed = parseIngredientForm(formData)
  if (!parsed.valid) {
    return { success: false, error: parsed.error }
  }

  const supabase = await createClient()

  const { data: ingredient, error } = await supabase
    .from('ingredients')
    .insert({
      company_id: companyResult.companyId,
      ...parsed.data,
    })
    .select('id')
    .single()

  if (error) {
    console.error('createIngredient error:', error.message)
    return { success: false, error: 'Erro ao criar ingrediente.' }
  }

  // Record initial stock movement if stock > 0
  if (parsed.data.current_stock > 0 && ingredient) {
    await supabase.from('stock_movements').insert({
      company_id: companyResult.companyId,
      ingredient_id: ingredient.id,
      type: 'in',
      quantity: parsed.data.current_stock,
      reference_type: 'manual',
      cost_at_time: parsed.data.average_cost,
      notes: 'Estoque inicial',
    })
  }

  revalidatePath('/ingredientes')
  return { success: true }
}

export async function updateIngredient(
  id: string,
  formData: FormData,
): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const parsed = parseIngredientForm(formData)
  if (!parsed.valid) {
    return { success: false, error: parsed.error }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('ingredients')
    .update(parsed.data)
    .eq('id', id)
    .eq('company_id', companyResult.companyId)

  if (error) {
    console.error('updateIngredient error:', error.message)
    return { success: false, error: 'Erro ao atualizar ingrediente.' }
  }

  revalidatePath('/ingredientes')
  return { success: true }
}

export async function deleteIngredient(id: string): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const supabase = await createClient()

  const { data: ingredient, error: ingredientError } = await supabase
    .from('ingredients')
    .select('id')
    .eq('id', id)
    .eq('company_id', companyResult.companyId)
    .single()

  if (ingredientError || !ingredient) {
    return { success: false, error: 'Ingrediente não encontrado.' }
  }

  const [{ data: recipeItems }, { data: purchases }, { data: movements }] =
    await Promise.all([
      supabase
        .from('recipe_items')
        .select('id')
        .eq('ingredient_id', id)
        .eq('company_id', companyResult.companyId)
        .limit(1),
      supabase
        .from('ingredient_purchases')
        .select('id')
        .eq('ingredient_id', id)
        .eq('company_id', companyResult.companyId)
        .limit(1),
      supabase
        .from('stock_movements')
        .select('id')
        .eq('ingredient_id', id)
        .eq('company_id', companyResult.companyId)
        .limit(1),
    ])

  if (recipeItems && recipeItems.length > 0) {
    return {
      success: false,
      error:
        'Este ingrediente está em uma ficha técnica e não pode ser excluído.',
    }
  }

  if (purchases && purchases.length > 0) {
    return {
      success: false,
      error:
        'Este ingrediente possui compras registradas e não pode ser excluído. Mantenha-o no cadastro para preservar o histórico.',
    }
  }

  if (movements && movements.length > 0) {
    return {
      success: false,
      error:
        'Este ingrediente possui movimentações de estoque e não pode ser excluído. Mantenha-o no cadastro para preservar o histórico.',
    }
  }

  const { error } = await supabase
    .from('ingredients')
    .delete()
    .eq('id', id)
    .eq('company_id', companyResult.companyId)

  if (error) {
    console.error('deleteIngredient error:', error.message)
    return { success: false, error: 'Erro ao excluir ingrediente.' }
  }

  revalidatePath('/ingredientes')
  return { success: true }
}
