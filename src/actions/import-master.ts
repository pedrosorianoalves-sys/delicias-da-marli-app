'use server'

import { revalidatePath } from 'next/cache'

import { requireCompanyRole } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  areUnitsCompatible,
  convertQuantityToIngredientUnit,
} from '@/lib/product-costing'
import { recalculateProductMetrics } from '@/lib/supabase/product-metrics'
import type { ActionResponse, Ingredient, Product, Unit } from '@/types'

const VALID_UNITS: Unit[] = ['g', 'kg', 'ml', 'l', 'unidade']

type ImportPurchaseInput = {
  quantity?: unknown
  unit?: unknown
  total_price?: unknown
  supplier?: unknown
}

type ImportIngredientInput = {
  name?: unknown
  unit?: unknown
  initial_stock?: unknown
  minimum_stock?: unknown
  supplier?: unknown
  purchase?: ImportPurchaseInput
}

type ImportRecipeItemInput = {
  ingredient?: unknown
  quantity?: unknown
  unit?: unknown
}

type ImportProductInput = {
  name?: unknown
  category?: unknown
  description?: unknown
  sale_price?: unknown
  price?: unknown
  active?: unknown
  is_active?: unknown
  recipe?: ImportRecipeItemInput[]
}

type ImportPayload = {
  ingredients?: ImportIngredientInput[]
  products?: ImportProductInput[]
}

export type ImportIssue = {
  path: string
  message: string
}

export type ImportPreview = {
  ingredients: {
    name: string
    unit: Unit
    initial_stock: number
    minimum_stock: number
    supplier: string | null
    has_purchase: boolean
  }[]
  purchases: {
    ingredient: string
    quantity: number
    unit: Unit
    total_price: number
    supplier: string | null
  }[]
  products: {
    name: string
    category: string | null
    sale_price: number
    active: boolean
  }[]
  recipes: {
    product: string
    ingredient: string
    quantity: number
    unit: Unit
  }[]
}

export type ImportSummary = {
  ingredients_created: number
  ingredients_updated: number
  purchases_created: number
  stock_movements_created: number
  products_created: number
  products_updated: number
  recipes_replaced: number
  recipe_items_created: number
}

export type ImportValidationResult = {
  success: boolean
  preview?: ImportPreview
  issues?: ImportIssue[]
  error?: string
}

export type ImportRunResult = ActionResponse<{
  preview: ImportPreview
  summary: ImportSummary
  issues: ImportIssue[]
}>

type NormalizedIngredient = {
  name: string
  unit: Unit
  initialStock: number
  minimumStock: number
  supplier: string | null
  hasInitialStock: boolean
  hasMinimumStock: boolean
  hasSupplier: boolean
  purchase: NormalizedPurchase | null
}

type NormalizedPurchase = {
  quantity: number
  unit: Unit
  totalPrice: number
  supplier: string | null
}

type NormalizedProduct = {
  name: string
  category: string | null
  description: string | null
  salePrice: number
  active: boolean
  recipe: NormalizedRecipeItem[]
}

type NormalizedRecipeItem = {
  ingredient: string
  quantity: number
  unit: Unit
}

type NormalizedPayload = {
  ingredients: NormalizedIngredient[]
  products: NormalizedProduct[]
}

type IngredientRow = Pick<
  Ingredient,
  'id' | 'name' | 'unit' | 'current_stock' | 'average_cost'
> & {
  min_stock: number | string
  supplier: string | null
}

type ProductRow = Pick<Product, 'id' | 'name' | 'sale_price'>

type SupabaseErrorLike = {
  message?: string
  details?: string | null
  hint?: string | null
  code?: string | null
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR')
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asOptionalString(value: unknown) {
  const stringValue = asString(value)
  return stringValue || null
}

function asNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    return Number(value.replace(',', '.'))
  }
  return Number.NaN
}

function isUnit(value: unknown): value is Unit {
  return typeof value === 'string' && VALID_UNITS.includes(value as Unit)
}

function formatSupabaseError({
  table,
  operation,
  subject,
  error,
}: {
  table: string
  operation: string
  subject: string
  error: SupabaseErrorLike | null | undefined
}) {
  const parts = [
    `Erro em ${table} ao ${operation} ${subject}: ${error?.message ?? 'erro desconhecido'}`,
  ]

  if (error?.details) parts.push(`Detalhes: ${error.details}`)
  if (error?.hint) parts.push(`Dica: ${error.hint}`)
  if (error?.code) parts.push(`Código: ${error.code}`)

  return parts.join(' ')
}

function errorMentions(error: SupabaseErrorLike | null | undefined, value: string) {
  const haystack = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('pt-BR')

  return haystack.includes(value.toLocaleLowerCase('pt-BR'))
}

function parsePayload(jsonText: string): { payload: ImportPayload } | { error: string } {
  try {
    const parsed = JSON.parse(jsonText) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: 'JSON deve ser um objeto.' }
    }
    return { payload: parsed as ImportPayload }
  } catch {
    return { error: 'JSON inválido. Confira vírgulas, aspas e chaves.' }
  }
}

function normalizePayload(payload: ImportPayload) {
  const issues: ImportIssue[] = []
  const ingredientsInput = Array.isArray(payload.ingredients)
    ? payload.ingredients
    : []
  const productsInput = Array.isArray(payload.products) ? payload.products : []

  if (!Array.isArray(payload.ingredients) && payload.ingredients !== undefined) {
    issues.push({ path: 'ingredients', message: 'ingredients deve ser uma lista.' })
  }
  if (!Array.isArray(payload.products) && payload.products !== undefined) {
    issues.push({ path: 'products', message: 'products deve ser uma lista.' })
  }
  if (ingredientsInput.length === 0 && productsInput.length === 0) {
    issues.push({
      path: '$',
      message: 'Informe pelo menos um ingrediente ou produto.',
    })
  }

  const ingredients: NormalizedIngredient[] = []
  const ingredientNames = new Set<string>()

  ingredientsInput.forEach((item, index) => {
    const path = `ingredients[${index}]`
    const name = asString(item.name)
    const unit = item.unit
    const initialStock =
      item.initial_stock === undefined ? 0 : asNumber(item.initial_stock)
    const minimumStock =
      item.minimum_stock === undefined ? 0 : asNumber(item.minimum_stock)
    const supplier = asOptionalString(item.supplier)

    if (!name) issues.push({ path: `${path}.name`, message: 'Nome é obrigatório.' })
    if (!isUnit(unit)) {
      issues.push({ path: `${path}.unit`, message: 'Unidade inválida.' })
    }
    if (Number.isNaN(initialStock) || initialStock < 0) {
      issues.push({
        path: `${path}.initial_stock`,
        message: 'Estoque inicial deve ser maior ou igual a zero.',
      })
    }
    if (Number.isNaN(minimumStock) || minimumStock < 0) {
      issues.push({
        path: `${path}.minimum_stock`,
        message: 'Estoque mínimo deve ser maior ou igual a zero.',
      })
    }

    const normalizedName = normalizeName(name)
    if (normalizedName && ingredientNames.has(normalizedName)) {
      issues.push({
        path: `${path}.name`,
        message: 'Ingrediente duplicado no JSON.',
      })
    }
    if (normalizedName) ingredientNames.add(normalizedName)

    let purchase: NormalizedPurchase | null = null
    if (item.purchase) {
      const purchasePath = `${path}.purchase`
      const quantity = asNumber(item.purchase.quantity)
      const purchaseUnit = item.purchase.unit ?? unit
      const totalPrice = asNumber(item.purchase.total_price)
      const purchaseSupplier = asOptionalString(item.purchase.supplier) ?? supplier

      if (Number.isNaN(quantity) || quantity <= 0) {
        issues.push({
          path: `${purchasePath}.quantity`,
          message: 'Quantidade da compra deve ser maior que zero.',
        })
      }
      if (!isUnit(purchaseUnit)) {
        issues.push({
          path: `${purchasePath}.unit`,
          message: 'Unidade da compra inválida.',
        })
      }
      if (Number.isNaN(totalPrice) || totalPrice < 0) {
        issues.push({
          path: `${purchasePath}.total_price`,
          message: 'Valor total da compra deve ser maior ou igual a zero.',
        })
      }
      if (isUnit(unit) && isUnit(purchaseUnit) && !areUnitsCompatible(unit, purchaseUnit)) {
        issues.push({
          path: `${purchasePath}.unit`,
          message: 'Unidade da compra incompatível com a unidade do ingrediente.',
        })
      }

      if (!Number.isNaN(quantity) && isUnit(purchaseUnit) && !Number.isNaN(totalPrice)) {
        purchase = {
          quantity,
          unit: purchaseUnit,
          totalPrice,
          supplier: purchaseSupplier,
        }
      }
    }

    if (name && isUnit(unit) && !Number.isNaN(initialStock) && !Number.isNaN(minimumStock)) {
      ingredients.push({
        name,
        unit,
        initialStock,
        minimumStock,
        supplier,
        hasInitialStock: item.initial_stock !== undefined,
        hasMinimumStock: item.minimum_stock !== undefined,
        hasSupplier: item.supplier !== undefined,
        purchase,
      })
    }
  })

  const products: NormalizedProduct[] = []
  const productNames = new Set<string>()

  productsInput.forEach((item, index) => {
    const path = `products[${index}]`
    const name = asString(item.name)
    const category = asOptionalString(item.category)
    const description = asOptionalString(item.description)
    const salePrice = asNumber(item.sale_price ?? item.price)
    const activeValue = item.active ?? item.is_active
    const active = activeValue === undefined ? true : Boolean(activeValue)
    const recipeInput = Array.isArray(item.recipe) ? item.recipe : []

    if (!name) issues.push({ path: `${path}.name`, message: 'Nome é obrigatório.' })
    if (Number.isNaN(salePrice) || salePrice <= 0) {
      issues.push({
        path: `${path}.sale_price`,
        message: 'Preço de venda deve ser maior que zero.',
      })
    }
    if (!Array.isArray(item.recipe)) {
      issues.push({ path: `${path}.recipe`, message: 'Receita deve ser uma lista.' })
    }

    const normalizedName = normalizeName(name)
    if (normalizedName && productNames.has(normalizedName)) {
      issues.push({ path: `${path}.name`, message: 'Produto duplicado no JSON.' })
    }
    if (normalizedName) productNames.add(normalizedName)

    const recipe: NormalizedRecipeItem[] = []
    recipeInput.forEach((recipeItem, recipeIndex) => {
      const recipePath = `${path}.recipe[${recipeIndex}]`
      const ingredient = asString(recipeItem.ingredient)
      const quantity = asNumber(recipeItem.quantity)
      const unit = recipeItem.unit

      if (!ingredient) {
        issues.push({
          path: `${recipePath}.ingredient`,
          message: 'Ingrediente da receita é obrigatório.',
        })
      }
      if (Number.isNaN(quantity) || quantity <= 0) {
        issues.push({
          path: `${recipePath}.quantity`,
          message: 'Quantidade da receita deve ser maior que zero.',
        })
      }
      if (!isUnit(unit)) {
        issues.push({ path: `${recipePath}.unit`, message: 'Unidade inválida.' })
      }

      if (ingredient && !Number.isNaN(quantity) && isUnit(unit)) {
        recipe.push({ ingredient, quantity, unit })
      }
    })

    if (name && !Number.isNaN(salePrice)) {
      products.push({ name, category, description, salePrice, active, recipe })
    }
  })

  const preview = buildPreview({ ingredients, products })
  return { normalized: { ingredients, products }, preview, issues }
}

function buildPreview(normalized: NormalizedPayload): ImportPreview {
  return {
    ingredients: normalized.ingredients.map((ingredient) => ({
      name: ingredient.name,
      unit: ingredient.unit,
      initial_stock: ingredient.initialStock,
      minimum_stock: ingredient.minimumStock,
      supplier: ingredient.supplier,
      has_purchase: !!ingredient.purchase,
    })),
    purchases: normalized.ingredients.flatMap((ingredient) =>
      ingredient.purchase
        ? [
            {
              ingredient: ingredient.name,
              quantity: ingredient.purchase.quantity,
              unit: ingredient.purchase.unit,
              total_price: ingredient.purchase.totalPrice,
              supplier: ingredient.purchase.supplier,
            },
          ]
        : [],
    ),
    products: normalized.products.map((product) => ({
      name: product.name,
      category: product.category,
      sale_price: product.salePrice,
      active: product.active,
    })),
    recipes: normalized.products.flatMap((product) =>
      product.recipe.map((item) => ({
        product: product.name,
        ingredient: item.ingredient,
        quantity: item.quantity,
        unit: item.unit,
      })),
    ),
  }
}

function revalidateImportPaths() {
  revalidatePath('/importar')
  revalidatePath('/ingredientes')
  revalidatePath('/compras')
  revalidatePath('/produtos')
  revalidatePath('/receitas')
  revalidatePath('/dashboard')
}

async function insertProductWithMetrics({
  supabase,
  companyId,
  productInput,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  companyId: string
  productInput: NormalizedProduct
}) {
  const productData = {
    company_id: companyId,
    name: productInput.name,
    category: productInput.category,
    description: productInput.description,
    sale_price: productInput.salePrice,
    is_active: productInput.active,
    estimated_cost: 0,
    gross_margin: 0,
  }

  const insert = await supabase
    .from('products')
    .insert({
      ...productData,
      cmv_percent: 0,
    })
    .select('id, name, sale_price')
    .single<ProductRow>()

  if (!insert.error) return insert

  if (!errorMentions(insert.error, 'cmv_percent')) return insert

  return supabase
    .from('products')
    .insert({
      ...productData,
      cmv: 0,
    })
    .select('id, name, sale_price')
    .single<ProductRow>()
}

async function updateProductWithMetrics({
  supabase,
  companyId,
  productId,
  productInput,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  companyId: string
  productId: string
  productInput: NormalizedProduct
}) {
  const productData = {
    category: productInput.category,
    description: productInput.description,
    sale_price: productInput.salePrice,
    is_active: productInput.active,
  }

  const update = await supabase
    .from('products')
    .update(productData)
    .eq('id', productId)
    .eq('company_id', companyId)

  return update
}

export async function validateMasterImportJson(
  jsonText: string,
): Promise<ImportValidationResult> {
  const parsed = parsePayload(jsonText)
  if ('error' in parsed) return { success: false, error: parsed.error }

  const { preview, issues } = normalizePayload(parsed.payload)
  return {
    success: issues.length === 0,
    preview,
    issues,
    error: issues.length > 0 ? 'Corrija os erros antes de importar.' : undefined,
  }
}

export async function importMasterJson(jsonText: string): Promise<ImportRunResult> {
  const context = await requireCompanyRole()
  if ('error' in context) return { success: false, error: context.error }

  const parsed = parsePayload(jsonText)
  if ('error' in parsed) return { success: false, error: parsed.error }

  const { normalized, preview, issues } = normalizePayload(parsed.payload)
  if (issues.length > 0) {
    return {
      success: false,
      error: 'Corrija os erros antes de importar.',
      data: {
        preview,
        summary: emptySummary(),
        issues,
      },
    }
  }

  const supabase = await createClient()
  const summary = emptySummary()
  const importIssues: ImportIssue[] = []

  const { data: existingIngredients, error: ingredientsError } = await supabase
    .from('ingredients')
    .select('id, name, unit, current_stock, average_cost, min_stock, supplier')
    .eq('company_id', context.companyId)
    .returns<IngredientRow[]>()

  if (ingredientsError) {
    console.error('importMasterJson ingredients read error:', ingredientsError.message)
    return { success: false, error: 'Erro ao carregar ingredientes atuais.' }
  }

  const ingredientsByName = new Map<string, IngredientRow>()
  for (const ingredient of existingIngredients ?? []) {
    ingredientsByName.set(normalizeName(ingredient.name), ingredient)
  }

  for (const ingredientInput of normalized.ingredients) {
    const key = normalizeName(ingredientInput.name)
    const existing = ingredientsByName.get(key)

    if (existing && !areUnitsCompatible(existing.unit, ingredientInput.unit)) {
      importIssues.push({
        path: `ingredients.${ingredientInput.name}.unit`,
        message: 'Ingrediente existente tem unidade incompatível.',
      })
      continue
    }

    let ingredient = existing

    if (!ingredient) {
      const currentStock = ingredientInput.purchase ? 0 : ingredientInput.initialStock
      const { data: created, error } = await supabase
        .from('ingredients')
        .insert({
          company_id: context.companyId,
          name: ingredientInput.name,
          unit: ingredientInput.unit,
          current_stock: currentStock,
          average_cost: 0,
          min_stock: ingredientInput.minimumStock,
          supplier: ingredientInput.supplier,
        })
        .select('id, name, unit, current_stock, average_cost, min_stock, supplier')
        .single<IngredientRow>()

      if (error || !created) {
        console.error('importMasterJson ingredient create error:', error)
        importIssues.push({
          path: `ingredients.${ingredientInput.name}`,
          message: formatSupabaseError({
            table: 'ingredients',
            operation: 'criar ingrediente',
            subject: ingredientInput.name,
            error,
          }),
        })
        continue
      }

      ingredient = created
      ingredientsByName.set(key, created)
      summary.ingredients_created += 1

      if (!ingredientInput.purchase && ingredientInput.initialStock > 0) {
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            company_id: context.companyId,
            ingredient_id: created.id,
            type: 'in',
            quantity: ingredientInput.initialStock,
            reference_type: 'manual',
            cost_at_time: 0,
            notes: 'Estoque inicial importado',
          })

        if (!movementError) summary.stock_movements_created += 1
      }
    } else {
      const updatePayload: { min_stock?: number; supplier?: string | null } = {}

      if (ingredientInput.hasMinimumStock) {
        updatePayload.min_stock = ingredientInput.minimumStock
      }

      if (ingredientInput.hasSupplier) {
        updatePayload.supplier = ingredientInput.supplier
      }

      if (Object.keys(updatePayload).length === 0) {
        ingredientsByName.set(key, ingredient)
      } else {
        const { error } = await supabase
          .from('ingredients')
          .update(updatePayload)
          .eq('id', ingredient.id)
          .eq('company_id', context.companyId)

        if (error) {
          console.error('importMasterJson ingredient update error:', error)
          importIssues.push({
            path: `ingredients.${ingredientInput.name}`,
            message: formatSupabaseError({
              table: 'ingredients',
              operation: 'atualizar ingrediente',
              subject: ingredientInput.name,
              error,
            }),
          })
          continue
        }

        ingredient = {
          ...ingredient,
          ...updatePayload,
        }
        ingredientsByName.set(key, ingredient)
        summary.ingredients_updated += 1
      }
    }

    if (ingredientInput.purchase) {
      const purchase = ingredientInput.purchase
      const quantityInIngredientUnit = convertQuantityToIngredientUnit(
        purchase.quantity,
        purchase.unit,
        ingredient.unit,
      )

      if (quantityInIngredientUnit === null || quantityInIngredientUnit <= 0) {
        importIssues.push({
          path: `ingredients.${ingredientInput.name}.purchase.unit`,
          message: 'Unidade da compra incompatível com a unidade do ingrediente.',
        })
        continue
      }

      const unitCost = purchase.totalPrice / quantityInIngredientUnit
      const purchaseNotes =
        purchase.unit === ingredient.unit
          ? 'Compra importada'
          : `Compra importada (${purchase.quantity}${purchase.unit})`

      let duplicatePurchaseQuery = supabase
        .from('ingredient_purchases')
        .select('id')
        .eq('company_id', context.companyId)
        .eq('ingredient_id', ingredient.id)
        .eq('quantity', quantityInIngredientUnit)
        .eq('total_cost', purchase.totalPrice)
        .eq('notes', purchaseNotes)
        .limit(1)

      duplicatePurchaseQuery = purchase.supplier
        ? duplicatePurchaseQuery.eq('supplier', purchase.supplier)
        : duplicatePurchaseQuery.is('supplier', null)

      const { data: duplicatePurchase, error: duplicatePurchaseError } =
        await duplicatePurchaseQuery.maybeSingle<{ id: string }>()

      if (duplicatePurchaseError) {
        console.error(
          'importMasterJson duplicate purchase read error:',
          duplicatePurchaseError,
        )
        importIssues.push({
          path: `ingredients.${ingredientInput.name}.purchase`,
          message: formatSupabaseError({
            table: 'ingredient_purchases',
            operation: 'verificar compra existente de',
            subject: ingredientInput.name,
            error: duplicatePurchaseError,
          }),
        })
        continue
      }

      if (duplicatePurchase) {
        continue
      }

      const { error: purchaseError } = await supabase.rpc(
        'create_ingredient_purchase_transactional',
        {
          p_company_id: context.companyId,
          p_ingredient_id: ingredient.id,
          p_quantity: quantityInIngredientUnit,
          p_unit_cost: unitCost,
          p_supplier: purchase.supplier,
          p_notes: purchaseNotes,
          p_purchased_at: new Date().toISOString(),
        },
      )

      if (purchaseError) {
        console.error('importMasterJson purchase error:', purchaseError)
        importIssues.push({
          path: `ingredients.${ingredientInput.name}.purchase`,
          message: formatSupabaseError({
            table: 'ingredient_purchases',
            operation: 'registrar compra de',
            subject: ingredientInput.name,
            error: purchaseError,
          }),
        })
        continue
      }
      summary.stock_movements_created += 1
      summary.purchases_created += 1
    }
  }

  const { data: existingProducts, error: productsError } = await supabase
    .from('products')
    .select('id, name, sale_price')
    .eq('company_id', context.companyId)
    .returns<ProductRow[]>()

  if (productsError) {
    console.error('importMasterJson products read error:', productsError.message)
    return { success: false, error: 'Erro ao carregar produtos atuais.' }
  }

  const productsByName = new Map<string, ProductRow>()
  for (const product of existingProducts ?? []) {
    productsByName.set(normalizeName(product.name), product)
  }

  for (const productInput of normalized.products) {
    const key = normalizeName(productInput.name)
    let product = productsByName.get(key)
    const recipeValidationIssues = productInput.recipe.flatMap((item) => {
      const ingredient = ingredientsByName.get(normalizeName(item.ingredient))

      if (!ingredient) {
        return [
          {
            path: `products.${productInput.name}.recipe.${item.ingredient}`,
            message: 'Ingrediente da receita não encontrado.',
          },
        ]
      }

      if (!areUnitsCompatible(ingredient.unit, item.unit)) {
        return [
          {
            path: `products.${productInput.name}.recipe.${item.ingredient}`,
            message: 'Unidade da receita incompatível com o ingrediente.',
          },
        ]
      }

      return []
    })

    if (recipeValidationIssues.length > 0) {
      importIssues.push(...recipeValidationIssues)
      continue
    }

    if (!product) {
      const { data: created, error } = await insertProductWithMetrics({
        supabase,
        companyId: context.companyId,
        productInput,
      })

      if (error || !created) {
        console.error('importMasterJson product create error:', error)
        importIssues.push({
          path: `products.${productInput.name}`,
          message: formatSupabaseError({
            table: 'products',
            operation: 'criar produto',
            subject: productInput.name,
            error,
          }),
        })
        continue
      }

      product = created
      productsByName.set(key, created)
      summary.products_created += 1
    } else {
      const { error } = await updateProductWithMetrics({
        supabase,
        companyId: context.companyId,
        productId: product.id,
        productInput,
      })

      if (error) {
        console.error('importMasterJson product update error:', error)
        importIssues.push({
          path: `products.${productInput.name}`,
          message: formatSupabaseError({
            table: 'products',
            operation: 'atualizar produto',
            subject: productInput.name,
            error,
          }),
        })
        continue
      }

      product = { ...product, sale_price: productInput.salePrice }
      productsByName.set(key, product)
      summary.products_updated += 1
    }

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .upsert(
        {
          company_id: context.companyId,
          product_id: product.id,
          yield_quantity: 1,
        },
        { onConflict: 'product_id' },
      )
      .select('id')
      .single<{ id: string }>()

    if (recipeError || !recipe) {
      console.error('importMasterJson recipe upsert error:', recipeError)
      importIssues.push({
        path: `products.${productInput.name}.recipe`,
        message: formatSupabaseError({
          table: 'recipes',
          operation: 'criar ficha técnica de',
          subject: productInput.name,
          error: recipeError,
        }),
      })
      continue
    }

    const { error: deleteError } = await supabase
      .from('recipe_items')
      .delete()
      .eq('recipe_id', recipe.id)
      .eq('company_id', context.companyId)

    if (deleteError) {
      console.error('importMasterJson recipe clear error:', deleteError)
      importIssues.push({
        path: `products.${productInput.name}.recipe`,
        message: formatSupabaseError({
          table: 'recipe_items',
          operation: 'limpar ficha técnica de',
          subject: productInput.name,
          error: deleteError,
        }),
      })
      continue
    }

    const recipeItems = productInput.recipe.flatMap((item) => {
      const ingredient = ingredientsByName.get(normalizeName(item.ingredient))
      if (!ingredient) {
        importIssues.push({
          path: `products.${productInput.name}.recipe.${item.ingredient}`,
          message: 'Ingrediente da receita não encontrado.',
        })
        return []
      }

      if (!areUnitsCompatible(ingredient.unit, item.unit)) {
        importIssues.push({
          path: `products.${productInput.name}.recipe.${item.ingredient}`,
          message: 'Unidade da receita incompatível com o ingrediente.',
        })
        return []
      }

      return [
        {
          company_id: context.companyId,
          recipe_id: recipe.id,
          ingredient_id: ingredient.id,
          quantity: item.quantity,
          unit: item.unit,
        },
      ]
    })

    if (recipeItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('recipe_items')
        .insert(recipeItems)

      if (itemsError) {
        console.error('importMasterJson recipe items error:', itemsError)
        importIssues.push({
          path: `products.${productInput.name}.recipe`,
          message: formatSupabaseError({
            table: 'recipe_items',
            operation: 'importar itens da ficha técnica de',
            subject: productInput.name,
            error: itemsError,
          }),
        })
        continue
      }

      summary.recipe_items_created += recipeItems.length
    }

    const recalculated = await recalculateProductMetrics(product.id, context.companyId)
    if (!recalculated.success) {
      importIssues.push({
        path: `products.${productInput.name}.recipe`,
        message: recalculated.error,
      })
      continue
    }

    summary.recipes_replaced += 1
  }

  revalidateImportPaths()

  return {
    success: importIssues.length === 0,
    error: importIssues.length > 0 ? 'Importação concluída com avisos.' : undefined,
    data: { preview, summary, issues: importIssues },
  }
}

function emptySummary(): ImportSummary {
  return {
    ingredients_created: 0,
    ingredients_updated: 0,
    purchases_created: 0,
    stock_movements_created: 0,
    products_created: 0,
    products_updated: 0,
    recipes_replaced: 0,
    recipe_items_created: 0,
  }
}
