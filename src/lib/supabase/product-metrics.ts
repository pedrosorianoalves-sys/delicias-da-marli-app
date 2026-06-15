import { createClient } from '@/lib/supabase/server'
import {
  calculateIngredientCost,
  calculateProductMetrics,
  type ProductMetrics,
} from '@/lib/product-costing'
import type { Unit } from '@/types'

type ProductSaleRow = {
  id: string
  sale_price: number | string
}

type RecipeRow = {
  id: string
}

type RecipeItemMetricRow = {
  quantity: number | string
  unit: Unit
  ingredient:
    | {
        average_cost: number | string
        unit: Unit
      }
    | {
        average_cost: number | string
        unit: Unit
      }[]
    | null
}

function getJoinedIngredient(row: RecipeItemMetricRow) {
  if (Array.isArray(row.ingredient)) return row.ingredient[0] ?? null
  return row.ingredient
}

export async function persistProductMetrics(
  productId: string,
  companyId: string,
  metrics: ProductMetrics,
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('products')
    .update(metrics)
    .eq('id', productId)
    .eq('company_id', companyId)

  if (!error) return { success: true as const }

  if (!error.message.includes('cmv_percent')) {
    console.error('persistProductMetrics error:', error.message)
    return { success: false as const, error: 'Erro ao atualizar métricas.' }
  }

  const { error: legacyError } = await supabase
    .from('products')
    .update({
      estimated_cost: metrics.estimated_cost,
      gross_margin: metrics.gross_margin,
      cmv: metrics.cmv_percent,
    })
    .eq('id', productId)
    .eq('company_id', companyId)

  if (legacyError) {
    console.error('persistProductMetrics legacy error:', legacyError.message)
    return { success: false as const, error: 'Erro ao atualizar métricas.' }
  }

  return { success: true as const }
}

export async function recalculateProductMetrics(
  productId: string,
  companyId: string,
) {
  const supabase = await createClient()

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, sale_price')
    .eq('id', productId)
    .eq('company_id', companyId)
    .single<ProductSaleRow>()

  if (productError || !product) {
    return { success: false as const, error: 'Produto não encontrado.' }
  }

  const { data: recipe } = await supabase
    .from('recipes')
    .select('id')
    .eq('product_id', productId)
    .eq('company_id', companyId)
    .maybeSingle<RecipeRow>()

  if (!recipe) {
    const metrics = calculateProductMetrics(Number(product.sale_price), 0)
    const persisted = await persistProductMetrics(productId, companyId, metrics)
    if (!persisted.success) return persisted
    return { success: true as const, metrics }
  }

  const { data: items, error: itemsError } = await supabase
    .from('recipe_items')
    .select('quantity, unit, ingredient:ingredients(average_cost, unit)')
    .eq('recipe_id', recipe.id)
    .eq('company_id', companyId)
    .returns<RecipeItemMetricRow[]>()

  if (itemsError) {
    console.error('recalculateProductMetrics items error:', itemsError.message)
    return { success: false as const, error: 'Erro ao calcular receita.' }
  }

  let estimatedCost = 0

  for (const item of items ?? []) {
    const ingredient = getJoinedIngredient(item)
    if (!ingredient) {
      return { success: false as const, error: 'Ingrediente não encontrado.' }
    }

    const itemCost = calculateIngredientCost(
      {
        average_cost: Number(ingredient.average_cost),
        unit: ingredient.unit,
      },
      Number(item.quantity),
      item.unit,
    )

    if (itemCost === null) {
      return {
        success: false as const,
        error: 'Unidade da receita incompatível com a unidade do ingrediente.',
      }
    }

    estimatedCost += itemCost
  }

  const metrics = calculateProductMetrics(Number(product.sale_price), estimatedCost)
  const persisted = await persistProductMetrics(productId, companyId, metrics)
  if (!persisted.success) return persisted

  return { success: true as const, metrics }
}
