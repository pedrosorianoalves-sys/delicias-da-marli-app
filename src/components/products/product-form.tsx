'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageIcon, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { createProduct, updateProduct } from '@/actions/products'
import { formatCurrency, formatNumber, PRODUCT_CATEGORIES } from '@/lib/constants'
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
import { Textarea } from '@/components/ui/textarea'
import type { ActionResponse, Product } from '@/types'

interface ProductFormProps {
  product?: Product
}

const initialState: ActionResponse = { success: false }

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter()
  const isEditing = !!product
  const [category, setCategory] = useState(product?.category ?? '')
  const [isActive, setIsActive] = useState(product?.is_active ?? true)
  const [imagePreview, setImagePreview] = useState<string | null>(
    product?.image_url ?? null,
  )

  async function handleAction(
    _prev: ActionResponse,
    formData: FormData,
  ): Promise<ActionResponse> {
    formData.set('category', category)
    if (isActive) formData.set('is_active', 'on')
    else formData.delete('is_active')

    const result = isEditing
      ? await updateProduct(product.id, formData)
      : await createProduct(formData)

    if (result.success) {
      toast.success(
        isEditing
          ? 'Produto atualizado com sucesso!'
          : 'Produto criado com sucesso!',
      )
      router.push('/produtos')
    } else {
      toast.error(result.error ?? 'Erro inesperado.')
    }

    return result
  }

  const [, formAction, isPending] = useActionState(handleAction, initialState)

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ex: Bolo de pote chocolate"
          defaultValue={product?.name ?? ''}
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select
            value={category}
            onValueChange={(value) => setCategory(value ?? '')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="category" value={category} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sale_price">Preço de venda *</Label>
          <Input
            id="sale_price"
            name="sale_price"
            type="number"
            min={0.01}
            step="0.01"
            placeholder="0,00"
            defaultValue={product?.sale_price ?? ''}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Detalhes do produto, tamanho, embalagem..."
          defaultValue={product?.description ?? ''}
        />
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="image">Imagem principal</Label>
          <p className="text-xs text-muted-foreground">
            JPG, PNG ou WebP até 3MB. A imagem aparece no catálogo público.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="aspect-square overflow-hidden rounded-lg border bg-rose-50">
            {imagePreview ? (
              <div
                aria-label="Preview do produto"
                role="img"
                className="h-full w-full object-cover"
                style={{
                  backgroundImage: `url(${imagePreview})`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                }}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-rose-700">
                <ImageIcon className="size-8" />
                <span className="text-xs font-medium">Sem imagem</span>
              </div>
            )}
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center transition hover:bg-muted/40">
            <Upload className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium">Selecionar imagem</span>
            <span className="text-xs text-muted-foreground">
              A imagem será enviada ao salvar o produto.
            </span>
            <input
              id="image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) {
                  setImagePreview(product?.image_url ?? null)
                  return
                }

                setImagePreview(URL.createObjectURL(file))
              }}
            />
          </label>
        </div>
      </div>

      <label className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="size-4 accent-primary"
        />
        Produto ativo
      </label>

      {product && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Custo estimado</p>
            <p className="font-semibold">
              {formatCurrency(product.estimated_cost)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">CMV</p>
            <p className="font-semibold">
              {formatNumber(product.cmv_percent)}%
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Lucro bruto</p>
            <p className="font-semibold">
              {formatCurrency(product.gross_margin)}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending} className="min-w-32">
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Salvando...
            </>
          ) : isEditing ? (
            'Atualizar'
          ) : (
            'Criar produto'
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/produtos')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
