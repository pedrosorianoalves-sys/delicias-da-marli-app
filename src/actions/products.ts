'use server'

import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { requireCompanyRole } from '@/lib/auth/permissions'
import { normalizeProduct } from '@/lib/product-costing'
import { recalculateProductMetrics } from '@/lib/supabase/product-metrics'
import { revalidatePath } from 'next/cache'
import type { ActionResponse, Product } from '@/types'

type ProductRow = Omit<Product, 'cmv_percent'> & {
  cmv_percent?: number | null
  cmv?: number | null
}

const PRODUCT_IMAGE_BUCKET = 'product-images'
const MAX_PRODUCT_IMAGE_SIZE = 3 * 1024 * 1024
const ALLOWED_PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function getCompanyId(): Promise<
  { companyId: string; userId: string } | { error: string }
> {
  const result = await requireCompanyRole()
  if ('error' in result) return { error: result.error }
  return { companyId: result.companyId, userId: result.userId }
}

function revalidateProductPaths(productId?: string) {
  revalidatePath('/produtos')
  revalidatePath('/receitas')
  revalidatePath('/loja')
  if (productId) {
    revalidatePath(`/produtos/${productId}`)
    revalidatePath(`/receitas/${productId}`)
  }
}

function getProductImageFile(formData: FormData) {
  const file = formData.get('image')
  if (!(file instanceof File) || file.size === 0) return null
  return file
}

function validateProductImage(file: File | null) {
  if (!file) return { valid: true as const }

  if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false as const,
      error: 'Imagem deve estar em JPG, PNG ou WebP.',
    }
  }

  if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
    return {
      valid: false as const,
      error: 'Imagem deve ter no máximo 3MB.',
    }
  }

  return { valid: true as const }
}

function getImageExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

async function uploadProductImage({
  file,
  companyId,
  productId,
}: {
  file: File | null
  companyId: string
  productId: string
}): Promise<{ imageUrl: string | null } | { error: string }> {
  if (!file) return { imageUrl: null }

  const supabase = await createClient()
  const extension = getImageExtension(file)
  const path = `${companyId}/${productId}/${randomUUID()}.${extension}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, bytes, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('uploadProductImage error:', uploadError.message)
    return { error: 'Erro ao enviar imagem do produto.' }
  }

  const { data } = supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(path)

  return { imageUrl: data.publicUrl }
}

function parseProductForm(formData: FormData) {
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const category =
    (formData.get('category') as string | null)?.trim() || null
  const description =
    (formData.get('description') as string | null)?.trim() || null
  const salePrice = Number(formData.get('sale_price') ?? 0)
  const isActive = formData.get('is_active') === 'on'
  const imageFile = getProductImageFile(formData)

  const errors: string[] = []

  if (!name) errors.push('Nome é obrigatório.')
  if (isNaN(salePrice) || salePrice <= 0) {
    errors.push('Preço de venda deve ser maior que zero.')
  }

  const imageValidation = validateProductImage(imageFile)
  if (!imageValidation.valid) {
    errors.push(imageValidation.error)
  }

  if (errors.length > 0) {
    return { valid: false as const, error: errors.join(' ') }
  }

  return {
    valid: true as const,
    data: {
      name,
      category,
      description,
      sale_price: salePrice,
      is_active: isActive,
      imageFile,
    },
  }
}

export async function getProducts(): Promise<Product[]> {
  const result = await getCompanyId()
  if ('error' in result) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', result.companyId)
    .order('name')
    .returns<ProductRow[]>()

  if (error) {
    console.error('getProducts error:', error.message)
    return []
  }

  return (data ?? []).map((product) => normalizeProduct(product as Product))
}

export async function getActiveProducts(): Promise<Product[]> {
  const result = await getCompanyId()
  if ('error' in result) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', result.companyId)
    .eq('is_active', true)
    .order('name')
    .returns<ProductRow[]>()

  if (error) {
    console.error('getActiveProducts error:', error.message)
    return []
  }

  return (data ?? []).map((product) => normalizeProduct(product as Product))
}

export async function getProduct(id: string): Promise<Product | null> {
  const result = await getCompanyId()
  if ('error' in result) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('company_id', result.companyId)
    .single<ProductRow>()

  if (error || !data) return null

  return normalizeProduct(data as Product)
}

export async function createProduct(
  formData: FormData,
): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const parsed = parseProductForm(formData)
  if (!parsed.valid) {
    return { success: false, error: parsed.error }
  }

  const supabase = await createClient()
  const { imageFile, ...productData } = parsed.data
  let productInsert = await supabase
    .from('products')
    .insert({
      company_id: companyResult.companyId,
      ...productData,
      estimated_cost: 0,
      gross_margin: productData.sale_price,
      cmv_percent: 0,
    })
    .select('id')
    .single()

  if (productInsert.error?.message.includes('cmv_percent')) {
    productInsert = await supabase
      .from('products')
      .insert({
        company_id: companyResult.companyId,
        ...productData,
        estimated_cost: 0,
        gross_margin: productData.sale_price,
        cmv: 0,
      })
      .select('id')
      .single()
  }

  const { data: product, error } = productInsert

  if (error || !product) {
    console.error('createProduct error:', error?.message)
    return { success: false, error: 'Erro ao criar produto.' }
  }

  const uploadResult = await uploadProductImage({
    file: imageFile,
    companyId: companyResult.companyId,
    productId: product.id,
  })

  if ('error' in uploadResult) {
    await supabase
      .from('products')
      .delete()
      .eq('id', product.id)
      .eq('company_id', companyResult.companyId)
    return { success: false, error: uploadResult.error }
  }

  if (uploadResult.imageUrl) {
    const { error: imageError } = await supabase
      .from('products')
      .update({ image_url: uploadResult.imageUrl })
      .eq('id', product.id)
      .eq('company_id', companyResult.companyId)

    if (imageError) {
      console.error('createProduct image_url error:', imageError.message)
      await supabase
        .from('products')
        .delete()
        .eq('id', product.id)
        .eq('company_id', companyResult.companyId)
      return { success: false, error: 'Erro ao salvar imagem do produto.' }
    }
  }

  const { error: recipeError } = await supabase.from('recipes').insert({
    company_id: companyResult.companyId,
    product_id: product.id,
    yield_quantity: 1,
  })

  if (recipeError) {
    console.error('createProduct recipe error:', recipeError.message)
    await supabase
      .from('products')
      .delete()
      .eq('id', product.id)
      .eq('company_id', companyResult.companyId)
    return { success: false, error: 'Erro ao criar ficha técnica.' }
  }

  revalidateProductPaths(product.id)
  return { success: true }
}

export async function updateProduct(
  id: string,
  formData: FormData,
): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const parsed = parseProductForm(formData)
  if (!parsed.valid) {
    return { success: false, error: parsed.error }
  }

  const supabase = await createClient()
  const existing = await supabase
    .from('products')
    .select('id')
    .eq('id', id)
    .eq('company_id', companyResult.companyId)
    .single()

  if (existing.error || !existing.data) {
    return { success: false, error: 'Produto não encontrado.' }
  }

  const { imageFile, ...productData } = parsed.data
  const uploadResult = await uploadProductImage({
    file: imageFile,
    companyId: companyResult.companyId,
    productId: id,
  })

  if ('error' in uploadResult) {
    return { success: false, error: uploadResult.error }
  }

  const { data: product, error } = await supabase
    .from('products')
    .update({
      ...productData,
      ...(uploadResult.imageUrl ? { image_url: uploadResult.imageUrl } : {}),
    })
    .eq('id', id)
    .eq('company_id', companyResult.companyId)
    .select('id')
    .single()

  if (error || !product) {
    console.error('updateProduct error:', error?.message)
    return { success: false, error: 'Erro ao atualizar produto.' }
  }

  const recalculated = await recalculateProductMetrics(
    id,
    companyResult.companyId,
  )

  if (!recalculated.success) {
    return { success: false, error: recalculated.error }
  }

  revalidateProductPaths(id)
  return { success: true }
}

export async function setProductActive(
  id: string,
  isActive: boolean,
): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('company_id', companyResult.companyId)

  if (error) {
    console.error('setProductActive error:', error.message)
    return {
      success: false,
      error: isActive ? 'Erro ao ativar produto.' : 'Erro ao inativar produto.',
    }
  }

  revalidateProductPaths(id)
  return { success: true }
}

export async function deleteProduct(id: string): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const supabase = await createClient()

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('id', id)
    .eq('company_id', companyResult.companyId)
    .single()

  if (productError || !product) {
    return { success: false, error: 'Produto não encontrado.' }
  }

  const { data: orderItems, error: orderItemsError } = await supabase
    .from('order_items')
    .select('id')
    .eq('product_id', id)
    .eq('company_id', companyResult.companyId)
    .limit(1)

  if (orderItemsError) {
    console.error('deleteProduct order_items check error:', orderItemsError.message)
    return { success: false, error: 'Erro ao verificar histórico do produto.' }
  }

  if (orderItems && orderItems.length > 0) {
    return {
      success: false,
      error: 'Este produto já possui histórico e não pode ser excluído. Inative-o.',
    }
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('company_id', companyResult.companyId)

  if (error) {
    console.error('deleteProduct error:', error.message)
    return {
      success: false,
      error: 'Erro ao excluir produto. Se ele já tiver histórico, inative-o.',
    }
  }

  revalidateProductPaths(id)
  return { success: true }
}
