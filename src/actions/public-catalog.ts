'use server'

import { createClient } from '@/lib/supabase/server'

export interface PublicCatalogProduct {
  id: string
  name: string
  category: string | null
  description: string | null
  sale_price: number
  promotional_price: number | null
  image_url: string | null
}

interface PublicCatalogRow {
  id: string
  name: string
  category: string | null
  description: string | null
  sale_price: number | string
  promotional_price: number | string | null
  image_url: string | null
}

export async function getPublicCatalogProducts(): Promise<PublicCatalogProduct[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_public_catalog_products', {
    company_slug: 'delicias-da-marli',
  })

  if (error) {
    console.error('getPublicCatalogProducts error:', error.message)
    return []
  }

  if (!Array.isArray(data)) return []

  return (data as PublicCatalogRow[]).map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    sale_price: Number(product.sale_price),
    promotional_price:
      product.promotional_price === null ? null : Number(product.promotional_price),
    image_url: product.image_url,
  }))
}
