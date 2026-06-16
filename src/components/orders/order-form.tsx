'use client'

import { useActionState, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { createOrder, updateOrder } from '@/actions/orders'
import { formatCurrency, formatNumber, PAYMENT_METHODS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import type {
  ActionResponse,
  Customer,
  OrderItemFormData,
  OrderWithDetails,
  PaymentMethod,
  Product,
} from '@/types'

interface OrderFormProps {
  customers: Customer[]
  products: Product[]
  order?: OrderWithDetails
}

interface EditableItem extends OrderItemFormData {
  local_id: string
}

const initialState: ActionResponse = { success: false }

function toDateTimeInputValue(date: string) {
  const parsed = new Date(date)
  const offset = parsed.getTimezoneOffset()
  const local = new Date(parsed.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function createLocalId() {
  return crypto.randomUUID()
}

function formatCustomerSelectLabel(customer: Customer) {
  return customer.phone ? `${customer.name} · ${customer.phone}` : customer.name
}

function formatProductSelectLabel(product: Product) {
  return `${product.name} · ${formatCurrency(product.sale_price)}`
}

function getPaymentMethodLabel(value: PaymentMethod) {
  return PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value
}

export function OrderForm({ customers, products, order }: OrderFormProps) {
  const router = useRouter()
  const isEditing = !!order
  const [customerId, setCustomerId] = useState(order?.customer_id ?? '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    order?.payment_method ?? 'pix_manual',
  )
  const [discount, setDiscount] = useState(order?.discount ?? 0)
  const [items, setItems] = useState<EditableItem[]>(
    order?.order_items.map((item) => ({
      local_id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })) ?? [],
  )
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '')

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  )
  const selectableProducts = useMemo(() => {
    const productMap = new Map(products.map((product) => [product.id, product]))

    for (const item of order?.order_items ?? []) {
      if (!productMap.has(item.product_id)) {
        productMap.set(item.product_id, item.product)
      }
    }

    return Array.from(productMap.values())
  }, [order?.order_items, products])
  const productById = useMemo(
    () => new Map(selectableProducts.map((product) => [product.id, product])),
    [selectableProducts],
  )
  const selectedCustomer = customerId ? customerById.get(customerId) : null
  const selectedProduct = selectedProductId
    ? productById.get(selectedProductId)
    : null

  const summary = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unit_price),
      0,
    )
    const estimatedCost = items.reduce((sum, item) => {
      const product = productById.get(item.product_id)
      return sum + Number(item.quantity) * Number(product?.estimated_cost ?? 0)
    }, 0)
    const total = Math.max(0, subtotal - Number(discount || 0))
    const profit = total - estimatedCost
    const cmv = total > 0 ? (estimatedCost / total) * 100 : 0

    return { subtotal, estimatedCost, total, profit, cmv }
  }, [discount, items, productById])

  function addItem() {
    const product = productById.get(selectedProductId)
    if (!product) return

    setItems((current) => [
      ...current,
      {
        local_id: createLocalId(),
        product_id: product.id,
        quantity: 1,
        unit_price: product.sale_price,
      },
    ])
  }

  function updateItem(localId: string, patch: Partial<OrderItemFormData>) {
    setItems((current) =>
      current.map((item) =>
        item.local_id === localId ? { ...item, ...patch } : item,
      ),
    )
  }

  function removeItem(localId: string) {
    setItems((current) => current.filter((item) => item.local_id !== localId))
  }

  async function handleAction(
    _prev: ActionResponse,
    formData: FormData,
  ): Promise<ActionResponse> {
    formData.set('customer_id', customerId)
    formData.set('payment_method', paymentMethod)
    formData.set(
      'items_json',
      JSON.stringify(
        items.map(({ product_id, quantity, unit_price }) => ({
          product_id,
          quantity,
          unit_price,
        })),
      ),
    )

    const result = isEditing
      ? await updateOrder(order.id, formData)
      : await createOrder(formData)

    if (result.success) {
      toast.success(isEditing ? 'Pedido atualizado!' : 'Pedido criado!')
      router.push(isEditing ? `/pedidos/${order.id}` : '/pedidos')
      router.refresh()
    } else {
      toast.error(result.error ?? 'Erro inesperado.')
    }

    return result
  }

  const [, formAction, isPending] = useActionState(handleAction, initialState)

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados do pedido</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={customerId || 'none'}
                onValueChange={(value) =>
                  setCustomerId(value === 'none' ? '' : value ?? '')
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um cliente">
                    {selectedCustomer
                      ? formatCustomerSelectLabel(selectedCustomer)
                      : 'Sem cliente'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {formatCustomerSelectLabel(customer)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_date">Data e hora</Label>
              <Input
                id="order_date"
                name="order_date"
                type="datetime-local"
                defaultValue={toDateTimeInputValue(order?.order_date ?? new Date().toISOString())}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Pagamento</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{getPaymentMethodLabel(paymentMethod)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount">Desconto</Label>
              <Input
                id="discount"
                name="discount"
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(Number(event.target.value))}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={order?.notes ?? ''}
                placeholder="Entrega, combinação com cliente, detalhes internos..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={selectedProductId}
                onValueChange={(value) => setSelectedProductId(value ?? '')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha um produto">
                    {selectedProduct
                      ? formatProductSelectLabel(selectedProduct)
                      : 'Escolha um produto'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {selectableProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {formatProductSelectLabel(product)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={addItem} disabled={!selectedProductId}>
                <Plus className="size-4" />
                Adicionar
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum produto adicionado.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const product = productById.get(item.product_id)
                  const itemTotal = Number(item.quantity) * Number(item.unit_price)
                  const itemCost = Number(item.quantity) * Number(product?.estimated_cost ?? 0)

                  return (
                    <div
                      key={item.local_id}
                      className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_110px_130px_120px_32px]"
                    >
                      <div className="space-y-2">
                        <Label>Produto</Label>
                        <Select
                          value={item.product_id}
                          onValueChange={(value) => {
                            if (!value) return
                            const nextProduct = productById.get(value)
                            updateItem(item.local_id, {
                              product_id: value,
                              unit_price: nextProduct?.sale_price ?? item.unit_price,
                            })
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {product
                                ? formatProductSelectLabel(product)
                                : 'Produto não encontrado'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {selectableProducts.map((productOption) => (
                              <SelectItem key={productOption.id} value={productOption.id}>
                                {formatProductSelectLabel(productOption)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Custo un.: {formatCurrency(product?.estimated_cost ?? 0)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Qtd.</Label>
                        <Input
                          type="number"
                          min={0.0001}
                          step="0.0001"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.local_id, {
                              quantity: Number(event.target.value),
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Preço un.</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unit_price}
                          onChange={(event) =>
                            updateItem(item.local_id, {
                              unit_price: Number(event.target.value),
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Total</Label>
                        <div className="flex h-8 items-center rounded-lg border bg-muted/30 px-2 text-sm font-medium">
                          {formatCurrency(itemTotal)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Custo {formatCurrency(itemCost)}
                        </p>
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeItem(item.local_id)}
                          aria-label="Remover produto"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SummaryRow label="Subtotal" value={formatCurrency(summary.subtotal)} />
          <SummaryRow label="Desconto" value={formatCurrency(Number(discount || 0))} />
          <SummaryRow label="Total" value={formatCurrency(summary.total)} strong />
          <SummaryRow label="Custo estimado" value={formatCurrency(summary.estimatedCost)} />
          <SummaryRow label="Lucro bruto" value={formatCurrency(summary.profit)} />
          <SummaryRow label="CMV" value={`${formatNumber(summary.cmv)}%`} />

          <div className="flex gap-2 pt-3">
            <Button type="submit" disabled={isPending || items.length === 0} className="flex-1">
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Atualizar'
              ) : (
                'Criar pedido'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(isEditing ? `/pedidos/${order.id}` : '/pedidos')}
            >
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'text-base font-semibold' : 'font-medium'}>
        {value}
      </span>
    </div>
  )
}
