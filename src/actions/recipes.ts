'use server'

import { createClient } from '@/lib/supabase/server'
import { requireCompanyRole } from '@/lib/auth/permissions'
import {
  areUnitsCompatible,
  calculateIngredientCost,
  calculateProductMetrics,
  normalizeProduct,
} from '@/lib/product-costing'
import { recalculateProductMetrics } from '@/lib/supabase/product-metrics'
import { revalidatePath } from 'next/cache'
import type {
  ActionResponse,
  Ingredient,
  Product,
  Recipe,
  RecipeDetails,
  RecipeItem,
  RecipeItemWithCost,
  RecipeProductSummary,
  Unit,
} from '@/types'

type ProductRow = Omit<Product, 'cmv_percent'> & {
  cmv_percent?: number | null
  cmv?: number | null
}

type RecipeWithItemsRow = Recipe & {
  recipe_items?: { id: string }[]
}

type RecipeItemRow = RecipeItem & {
  ingredient: Ingredient | Ingredient[] | null
}

const VALID_UNITS: Unit[] = ['g', 'kg', 'ml', 'l', 'unidade']

async function getCompanyId(): Promise<
  { companyId: string; userId: string } | { error: string }
> {
  const result = await requireCompanyRole()
  if ('error' in result) return { error: result.error }
  return { companyId: result.companyId, userId: result.userId }
}

function revalidateRecipePaths(productId?: string) {
  revalidatePath('/receitas')
  revalidatePath('/produtos')
  if (productId) {
    revalidatePath(`/receitas/${productId}`)
    revalidatePath(`/produtos/${productId}`)
  }
}

function getJoinedIngredient(item: RecipeItemRow) {
  if (Array.isArray(item.ingredient)) return item.ingredient[0] ?? null
  return item.ingredient
}

function parseRecipeItemForm(formData: FormData) {
  const ingredientId = (formData.get('ingredient_id') as string | null) ?? ''
  const quantity = Number(formData.get('quantity') ?? 0)
  const unit = (formData.get('unit') as string | null) ?? ''

  const errors: string[] = []

  if (!ingredientId) errors.push('Selecione um ingrediente.')
  if (isNaN(quantity) || quantity <= 0) {
    errors.push('Quantidade deve ser maior que zero.')
  }
  if (!VALID_UNITS.includes(unit as Unit)) errors.push('Unidade inválida.')

  if (errors.length > 0) {
    return { valid: false as const, error: errors.join(' ') }
  }

  return {
    valid: true as const,
    data: {
      ingredient_id: ingredientId,
      quantity,
      unit: unit as Unit,
    },
  }
}

async function getOrCreateRecipe(
  productId: string,
  companyId: string,
): Promise<{ recipe: Recipe } | { error: string }> {
  const supabase = await createClient()

  const { data: existingRecipe, error: recipeError } = await supabase
    .from('recipes')
    .select('*')
    .eq('product_id', productId)
    .eq('company_id', companyId)
    .maybeSingle<Recipe>()

  if (recipeError) {
    console.error('getOrCreateRecipe read error:', recipeError.message)
    return { error: 'Erro ao carregar ficha técnica.' }
  }

  if (existingRecipe) return { recipe: existingRecipe }

  const { data: recipe, error: createError } = await supabase
    .from('recipes')
    .insert({
      company_id: companyId,
      product_id: productId,
      yield_quantity: 1,
    })
    .select('*')
    .single<Recipe>()

  if (createError || !recipe) {
    console.error('getOrCreateRecipe create error:', createError?.message)
    return { error: 'Erro ao criar ficha técnica.' }
  }

  return { recipe }
}

async function validateProductAndIngredient(
  productId: string,
  ingredientId: string,
  recipeUnit: Unit,
  companyId: string,
) {
  const supabase = await createClient()

  const [{ data: product }, { data: ingredient }] = await Promise.all([
    supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('company_id', companyId)
      .single(),
    supabase
      .from('ingredients')
      .select('*')
      .eq('id', ingredientId)
      .eq('company_id', companyId)
      .single<Ingredient>(),
  ])

  if (!product) return { error: 'Produto não encontrado.' }
  if (!ingredient) return { error: 'Ingrediente não encontrado.' }

  if (!areUnitsCompatible(ingredient.unit, recipeUnit)) {
    return {
      error: 'Unidade da receita incompatível com a unidade do ingrediente.',
    }
  }

  return { ingredient }
}

export async function getRecipeProductSummaries(): Promise<
  RecipeProductSummary[]
> {
  const result = await getCompanyId()
  if ('error' in result) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, recipes(id, recipe_items(id))')
    .eq('company_id', result.companyId)
    .order('name')
    .returns<(ProductRow & { recipes?: RecipeWithItemsRow[] })[]>()

  if (error) {
    console.error('getRecipeProductSummaries error:', error.message)
    return []
  }

  return (data ?? []).map((row) => {
    const recipe = row.recipes?.[0] ?? null
    const { recipes: unusedRecipes, ...productRow } = row
    void unusedRecipes

    return {
      product: normalizeProduct(productRow as Product),
      recipe_id: recipe?.id ?? null,
      item_count: recipe?.recipe_items?.length ?? 0,
    }
  })
}

export async function getRecipeDetails(
  productId: string,
): Promise<RecipeDetails | null> {
  const result = await getCompanyId()
  if ('error' in result) return null

  const supabase = await createClient()
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('company_id', result.companyId)
    .single<ProductRow>()

  if (productError || !product) return null

  const recipeResult = await getOrCreateRecipe(productId, result.companyId)
  if ('error' in recipeResult) return null

  const [{ data: recipeItems }, { data: ingredients }] = await Promise.all([
    supabase
      .from('recipe_items')
      .select('*, ingredient:ingredients(*)')
      .eq('recipe_id', recipeResult.recipe.id)
      .eq('company_id', result.companyId)
      .order('created_at')
      .returns<RecipeItemRow[]>(),
    supabase
      .from('ingredients')
      .select('*')
      .eq('company_id', result.companyId)
      .order('name')
      .returns<Ingredient[]>(),
  ])

  const items: RecipeItemWithCost[] = (recipeItems ?? []).flatMap((item) => {
    const ingredient = getJoinedIngredient(item)
    if (!ingredient) return []

    const itemCost = calculateIngredientCost(
      ingredient,
      Number(item.quantity),
      item.unit,
    )

    return [
      {
        ...item,
        ingredient,
        quantity: Number(item.quantity),
        item_cost: itemCost ?? 0,
      },
    ]
  })

  const totalCost = items.reduce((sum, item) => sum + item.item_cost, 0)
  const normalizedProduct = normalizeProduct(product as Product)
  const metrics = calculateProductMetrics(
    Number(normalizedProduct.sale_price),
    totalCost,
  )

  return {
    product: {
      ...normalizedProduct,
      estimated_cost: metrics.estimated_cost,
      gross_margin: metrics.gross_margin,
      cmv_percent: metrics.cmv_percent,
    },
    recipe: recipeResult.recipe,
    items,
    ingredients: ingredients ?? [],
    total_cost: metrics.estimated_cost,
    cmv_percent: metrics.cmv_percent,
    gross_margin: metrics.gross_margin,
  }
}

export async function addRecipeItem(
  productId: string,
  formData: FormData,
): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const parsed = parseRecipeItemForm(formData)
  if (!parsed.valid) {
    return { success: false, error: parsed.error }
  }

  const validation = await validateProductAndIngredient(
    productId,
    parsed.data.ingredient_id,
    parsed.data.unit,
    companyResult.companyId,
  )

  if ('error' in validation) {
    return { success: false, error: validation.error }
  }

  const recipeResult = await getOrCreateRecipe(productId, companyResult.companyId)
  if ('error' in recipeResult) {
    return { success: false, error: recipeResult.error }
  }

  const supabase = await createClient()

  const { data: duplicate } = await supabase
    .from('recipe_items')
    .select('id')
    .eq('recipe_id', recipeResult.recipe.id)
    .eq('ingredient_id', parsed.data.ingredient_id)
    .eq('company_id', companyResult.companyId)
    .limit(1)

  if (duplicate && duplicate.length > 0) {
    return {
      success: false,
      error: 'Este ingrediente já está na ficha técnica.',
    }
  }

  const { error } = await supabase.from('recipe_items').insert({
    company_id: companyResult.companyId,
    recipe_id: recipeResult.recipe.id,
    ...parsed.data,
  })

  if (error) {
    console.error('addRecipeItem error:', error.message)
    return { success: false, error: 'Erro ao adicionar ingrediente.' }
  }

  const recalculated = await recalculateProductMetrics(
    productId,
    companyResult.companyId,
  )

  if (!recalculated.success) {
    return { success: false, error: recalculated.error }
  }

  revalidateRecipePaths(productId)
  return { success: true }
}

export async function updateRecipeItem(
  itemId: string,
  productId: string,
  formData: FormData,
): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const parsed = parseRecipeItemForm(formData)
  if (!parsed.valid) {
    return { success: false, error: parsed.error }
  }

  const validation = await validateProductAndIngredient(
    productId,
    parsed.data.ingredient_id,
    parsed.data.unit,
    companyResult.companyId,
  )

  if ('error' in validation) {
    return { success: false, error: validation.error }
  }

  const supabase = await createClient()
  const { data: existingItem, error: existingError } = await supabase
    .from('recipe_items')
    .select('id, recipe_id')
    .eq('id', itemId)
    .eq('company_id', companyResult.companyId)
    .single()

  if (existingError || !existingItem) {
    return { success: false, error: 'Item da receita não encontrado.' }
  }

  const { data: duplicate } = await supabase
    .from('recipe_items')
    .select('id')
    .eq('recipe_id', existingItem.recipe_id)
    .eq('ingredient_id', parsed.data.ingredient_id)
    .eq('company_id', companyResult.companyId)
    .neq('id', itemId)
    .limit(1)

  if (duplicate && duplicate.length > 0) {
    return {
      success: false,
      error: 'Este ingrediente já está na ficha técnica.',
    }
  }

  const { error } = await supabase
    .from('recipe_items')
    .update(parsed.data)
    .eq('id', itemId)
    .eq('company_id', companyResult.companyId)

  if (error) {
    console.error('updateRecipeItem error:', error.message)
    return { success: false, error: 'Erro ao atualizar ingrediente.' }
  }

  const recalculated = await recalculateProductMetrics(
    productId,
    companyResult.companyId,
  )

  if (!recalculated.success) {
    return { success: false, error: recalculated.error }
  }

  revalidateRecipePaths(productId)
  return { success: true }
}

export async function deleteRecipeItem(
  itemId: string,
  productId: string,
): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('recipe_items')
    .delete()
    .eq('id', itemId)
    .eq('company_id', companyResult.companyId)

  if (error) {
    console.error('deleteRecipeItem error:', error.message)
    return { success: false, error: 'Erro ao remover ingrediente.' }
  }

  const recalculated = await recalculateProductMetrics(
    productId,
    companyResult.companyId,
  )

  if (!recalculated.success) {
    return { success: false, error: recalculated.error }
  }

  revalidateRecipePaths(productId)
  return { success: true }
}

export async function clearProductRecipe(
  productId: string,
): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const supabase = await createClient()

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('id')
    .eq('product_id', productId)
    .eq('company_id', companyResult.companyId)
    .maybeSingle<{ id: string }>()

  if (recipeError) {
    console.error('clearProductRecipe read error:', recipeError.message)
    return { success: false, error: 'Erro ao carregar ficha técnica.' }
  }

  if (!recipe) {
    return { success: false, error: 'Ficha técnica não encontrada.' }
  }

  const { error } = await supabase
    .from('recipe_items')
    .delete()
    .eq('recipe_id', recipe.id)
    .eq('company_id', companyResult.companyId)

  if (error) {
    console.error('clearProductRecipe error:', error.message)
    return { success: false, error: 'Erro ao limpar ficha técnica.' }
  }

  const recalculated = await recalculateProductMetrics(
    productId,
    companyResult.companyId,
  )

  if (!recalculated.success) {
    return { success: false, error: recalculated.error }
  }

  revalidateRecipePaths(productId)
  return { success: true }
}
