'use server'

import { createClient } from '@/lib/supabase/server'
import { requireCompanyRole } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import type { ActionResponse, IngredientPurchase } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCompanyId(): Promise<
  { companyId: string; userId: string } | { error: string }
> {
  const result = await requireCompanyRole()
  if ('error' in result) return { error: result.error }
  return { companyId: result.companyId, userId: result.userId }
}

function revalidatePurchasePaths() {
  revalidatePath('/compras')
  revalidatePath('/ingredientes')
  revalidatePath('/dashboard')
}

function parsePurchaseForm(formData: FormData) {
  const ingredientId = (formData.get('ingredient_id') as string | null) ?? ''
  const quantity = Number(formData.get('quantity'))
  const unitCost = Number(formData.get('unit_cost'))
  const supplier =
    (formData.get('supplier') as string | null)?.trim() || null
  const notes = (formData.get('notes') as string | null)?.trim() || null
  const purchasedAt =
    (formData.get('purchased_at') as string | null) ||
    new Date().toISOString().split('T')[0]

  if (!ingredientId) {
    return { valid: false as const, error: 'Selecione um ingrediente.' }
  }
  if (isNaN(quantity) || quantity <= 0) {
    return { valid: false as const, error: 'Quantidade deve ser maior que zero.' }
  }
  if (isNaN(unitCost) || unitCost < 0) {
    return { valid: false as const, error: 'Custo unitário deve ser >= 0.' }
  }

  return {
    valid: true as const,
    data: {
      ingredient_id: ingredientId,
      quantity,
      unit_cost: unitCost,
      total_cost: quantity * unitCost,
      supplier,
      notes,
      purchased_at: purchasedAt,
    },
  }
}

function getRpcError(error: { message?: string } | null | undefined, fallback: string) {
  return error?.message ?? fallback
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

export async function getPurchases(): Promise<IngredientPurchase[]> {
  const result = await getCompanyId()
  if ('error' in result) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ingredient_purchases')
    .select('*, ingredient:ingredients(id, name, unit)')
    .eq('company_id', result.companyId)
    .order('purchased_at', { ascending: false })

  if (error) {
    console.error('getPurchases error:', error.message)
    return []
  }

  return (data ?? []) as IngredientPurchase[]
}

export async function getPurchase(id: string): Promise<IngredientPurchase | null> {
  const result = await getCompanyId()
  if ('error' in result) return null

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ingredient_purchases')
    .select('*, ingredient:ingredients(id, name, unit)')
    .eq('id', id)
    .eq('company_id', result.companyId)
    .single()

  if (error) return null

  return data as IngredientPurchase
}

// ---------------------------------------------------------------------------
// CREATE — includes critical average cost recalculation
// ---------------------------------------------------------------------------

export async function createPurchase(
  formData: FormData,
): Promise<ActionResponse> {
  const parsed = parsePurchaseForm(formData)
  if (!parsed.valid) {
    return { success: false, error: parsed.error }
  }

  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc(
    'create_ingredient_purchase_transactional',
    {
      p_company_id: companyResult.companyId,
      p_ingredient_id: parsed.data.ingredient_id,
      p_quantity: parsed.data.quantity,
      p_unit_cost: parsed.data.unit_cost,
      p_supplier: parsed.data.supplier,
      p_notes: parsed.data.notes,
      p_purchased_at: parsed.data.purchased_at,
    })

  if (error) {
    console.error('createPurchase rpc error:', error.message)
    return { success: false, error: getRpcError(error, 'Erro ao registrar compra.') }
  }

  revalidatePurchasePaths()
  return { success: true }
}

// ---------------------------------------------------------------------------
// UPDATE — reverses the old purchase and applies the new purchase values
// ---------------------------------------------------------------------------

export async function updatePurchase(
  id: string,
  formData: FormData,
): Promise<ActionResponse> {
  const parsed = parsePurchaseForm(formData)
  if (!parsed.valid) {
    return { success: false, error: parsed.error }
  }

  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc(
    'update_ingredient_purchase_transactional',
    {
      p_company_id: companyResult.companyId,
      p_purchase_id: id,
      p_ingredient_id: parsed.data.ingredient_id,
      p_quantity: parsed.data.quantity,
      p_unit_cost: parsed.data.unit_cost,
      p_supplier: parsed.data.supplier,
      p_notes: parsed.data.notes,
      p_purchased_at: parsed.data.purchased_at,
    })

  if (error) {
    console.error('updatePurchase rpc error:', error.message)
    return { success: false, error: getRpcError(error, 'Erro ao atualizar compra.') }
  }

  revalidatePurchasePaths()
  return { success: true }
}

// ---------------------------------------------------------------------------
// DELETE — reverses stock & recalculates average cost
// ---------------------------------------------------------------------------

export async function deletePurchase(id: string): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc(
    'delete_ingredient_purchase_transactional',
    {
      p_company_id: companyResult.companyId,
      p_purchase_id: id,
    })

  if (error) {
    console.error('deletePurchase rpc error:', error.message)
    return { success: false, error: getRpcError(error, 'Erro ao excluir compra.') }
  }

  revalidatePurchasePaths()
  return { success: true }
}
