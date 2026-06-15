import type { Ingredient, Product, Unit } from '@/types'

const COMPATIBLE_UNITS: Record<Unit, Unit[]> = {
  kg: ['kg', 'g'],
  g: ['g', 'kg'],
  l: ['l', 'ml'],
  ml: ['ml', 'l'],
  unidade: ['unidade'],
}

export interface ProductMetrics {
  estimated_cost: number
  gross_margin: number
  cmv_percent: number
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

export function roundCost(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function getCompatibleUnits(unit: Unit): Unit[] {
  return COMPATIBLE_UNITS[unit]
}

export function areUnitsCompatible(ingredientUnit: Unit, recipeUnit: Unit) {
  return getCompatibleUnits(ingredientUnit).includes(recipeUnit)
}

export function convertQuantityToIngredientUnit(
  quantity: number,
  recipeUnit: Unit,
  ingredientUnit: Unit,
) {
  if (!areUnitsCompatible(ingredientUnit, recipeUnit)) return null
  if (recipeUnit === ingredientUnit) return quantity

  if (ingredientUnit === 'kg' && recipeUnit === 'g') return quantity / 1000
  if (ingredientUnit === 'g' && recipeUnit === 'kg') return quantity * 1000
  if (ingredientUnit === 'l' && recipeUnit === 'ml') return quantity / 1000
  if (ingredientUnit === 'ml' && recipeUnit === 'l') return quantity * 1000

  return null
}

export function calculateIngredientCost(
  ingredient: Pick<Ingredient, 'average_cost' | 'unit'>,
  quantity: number,
  recipeUnit: Unit,
) {
  const quantityInIngredientUnit = convertQuantityToIngredientUnit(
    quantity,
    recipeUnit,
    ingredient.unit,
  )

  if (quantityInIngredientUnit === null) return null

  return roundCost(quantityInIngredientUnit * Number(ingredient.average_cost))
}

export function calculateProductMetrics(
  salePrice: number,
  estimatedCost: number,
): ProductMetrics {
  const safeSalePrice = Number(salePrice)
  const safeEstimatedCost = Number(estimatedCost)
  const grossMargin = safeSalePrice - safeEstimatedCost
  const cmvPercent =
    safeSalePrice > 0 ? (safeEstimatedCost / safeSalePrice) * 100 : 0

  return {
    estimated_cost: roundCost(safeEstimatedCost),
    gross_margin: roundCurrency(grossMargin),
    cmv_percent: roundCurrency(cmvPercent),
  }
}

export function normalizeProduct(row: Product & { cmv?: number | null }) {
  return {
    ...row,
    sale_price: Number(row.sale_price),
    estimated_cost: Number(row.estimated_cost),
    gross_margin: Number(row.gross_margin),
    cmv_percent: Number(row.cmv_percent ?? row.cmv ?? 0),
  } satisfies Product
}
