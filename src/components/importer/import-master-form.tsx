'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileJson,
  Loader2,
  Play,
  SearchCheck,
} from 'lucide-react'

import {
  importMasterJson,
  validateMasterImportJson,
  type ImportIssue,
  type ImportPreview,
  type ImportSummary,
} from '@/actions/import-master'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatNumber } from '@/lib/constants'

const EXAMPLE_JSON = `{
  "customers": [
    {
      "name": "Luciana Costa",
      "phone": "21999999999",
      "email": "",
      "address": "",
      "notes": ""
    }
  ],
  "orders": [
    {
      "customer": {
        "name": "Luciana Costa",
        "phone": "21999999999"
      },
      "status": "pago",
      "payment_method": "pix_manual",
      "discount": 0,
      "ordered_at": "2026-06-16T14:30:00",
      "items": [
        {
          "product": "Bolo de pote de chocolate",
          "quantity": 2,
          "unit_price": 12,
          "courtesy_quantity": 1
        }
      ]
    }
  ]
}`

type Status = {
  type: 'idle' | 'success' | 'error' | 'warning'
  message: string
}

function IssuesList({ issues }: { issues: ImportIssue[] }) {
  if (issues.length === 0) return null

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4" />
          Pendências encontradas
        </CardTitle>
        <CardDescription>Corrija estes pontos antes de importar.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {issues.map((issue, index) => (
            <div
              key={`${issue.path}-${index}`}
              className="rounded-lg border border-destructive/20 bg-background px-3 py-2 text-sm"
            >
              <span className="font-medium text-destructive">{issue.path}</span>
              <span className="text-muted-foreground"> — {issue.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyPreviewMessage() {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      Valide o JSON para conferir o preview antes de importar.
    </div>
  )
}

function PreviewTables({ preview }: { preview: ImportPreview }) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Ingredientes</CardTitle>
          <CardDescription>
            {preview.ingredients.length} item(ns) detectado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview.ingredients.length === 0 ? (
            <EmptyRows label="Nenhum ingrediente no JSON." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Estoque inicial</TableHead>
                  <TableHead>Estoque mínimo</TableHead>
                  <TableHead>Fornecedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.ingredients.map((ingredient) => (
                  <TableRow key={ingredient.name}>
                    <TableCell className="font-medium">{ingredient.name}</TableCell>
                    <TableCell>{ingredient.unit}</TableCell>
                    <TableCell>{formatNumber(ingredient.initial_stock)}</TableCell>
                    <TableCell>{formatNumber(ingredient.minimum_stock)}</TableCell>
                    <TableCell>{ingredient.supplier ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compras iniciais</CardTitle>
          <CardDescription>{preview.purchases.length} compra(s) detectada(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {preview.purchases.length === 0 ? (
            <EmptyRows label="Nenhuma compra inicial no JSON." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Valor total</TableHead>
                  <TableHead>Fornecedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.purchases.map((purchase, index) => (
                  <TableRow key={`${purchase.ingredient}-${index}`}>
                    <TableCell className="font-medium">{purchase.ingredient}</TableCell>
                    <TableCell>
                      {formatNumber(purchase.quantity)} {purchase.unit}
                    </TableCell>
                    <TableCell>{formatCurrency(purchase.total_price)}</TableCell>
                    <TableCell>{purchase.supplier ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produtos</CardTitle>
          <CardDescription>{preview.products.length} produto(s) detectado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {preview.products.length === 0 ? (
            <EmptyRows label="Nenhum produto no JSON." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.products.map((product) => (
                  <TableRow key={product.name}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category ?? '-'}</TableCell>
                    <TableCell>{formatCurrency(product.sale_price)}</TableCell>
                    <TableCell>
                      <Badge variant={product.active ? 'secondary' : 'outline'}>
                        {product.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receitas</CardTitle>
          <CardDescription>
            {preview.recipes.length} ingrediente(s) de ficha técnica
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview.recipes.length === 0 ? (
            <EmptyRows label="Nenhuma receita no JSON." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead>Quantidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.recipes.map((item, index) => (
                  <TableRow key={`${item.product}-${item.ingredient}-${index}`}>
                    <TableCell className="font-medium">{item.product}</TableCell>
                    <TableCell>{item.ingredient}</TableCell>
                    <TableCell>
                      {formatNumber(item.quantity)} {item.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>
            {preview.customers.length} cliente(s) detectado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview.customers.length === 0 ? (
            <EmptyRows label="Nenhum cliente no JSON." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Alertas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.customers.map((customer, index) => (
                  <TableRow key={`${customer.name}-${customer.phone ?? index}`}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone ?? '-'}</TableCell>
                    <TableCell>{customer.email ?? '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          customer.action === 'ambiguo'
                            ? 'destructive'
                            : customer.action === 'novo'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {customer.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-64 text-xs text-muted-foreground">
                      {customer.alerts.length > 0 ? customer.alerts.join(' ') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
          <CardDescription>
            {preview.orders.length} pedido(s) detectado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview.orders.length === 0 ? (
            <EmptyRows label="Nenhum pedido no JSON." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Alertas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.orders.map((order, index) => (
                  <TableRow key={`${order.customer}-${order.ordered_at}-${index}`}>
                    <TableCell className="font-medium">{order.customer}</TableCell>
                    <TableCell>
                      <Badge variant={order.status === 'cancelado' ? 'destructive' : 'outline'}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.payment_method ?? '-'}</TableCell>
                    <TableCell>{order.items_count}</TableCell>
                    <TableCell>{formatCurrency(order.total)}</TableCell>
                    <TableCell>
                      {order.will_deduct_stock ? 'Vai baixar' : 'Não baixa'}
                    </TableCell>
                    <TableCell className="max-w-72 text-xs text-muted-foreground">
                      {order.alerts.length > 0 ? order.alerts.join(' ') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens de pedido</CardTitle>
          <CardDescription>
            {preview.order_items.length} item(ns) de pedido
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview.order_items.length === 0 ? (
            <EmptyRows label="Nenhum item de pedido no JSON." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Qtd.</TableHead>
                  <TableHead>Cortesia</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.order_items.map((item, index) => (
                  <TableRow key={`${item.order_index}-${item.product}-${index}`}>
                    <TableCell>#{item.order_index + 1}</TableCell>
                    <TableCell className="font-medium">{item.product}</TableCell>
                    <TableCell>{formatNumber(item.quantity)}</TableCell>
                    <TableCell>{formatNumber(item.courtesy_quantity)}</TableCell>
                    <TableCell>
                      {item.unit_price === null ? '-' : formatCurrency(item.unit_price)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.product_found ? 'secondary' : 'destructive'}>
                        {item.product_found ? 'Encontrado' : 'Não encontrado'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EmptyRows({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function SummaryCards({ summary }: { summary: ImportSummary }) {
  const items = [
    ['Ingredientes criados', summary.ingredients_created],
    ['Ingredientes atualizados', summary.ingredients_updated],
    ['Compras criadas', summary.purchases_created],
    ['Movimentações', summary.stock_movements_created],
    ['Produtos criados', summary.products_created],
    ['Produtos atualizados', summary.products_updated],
    ['Receitas substituídas', summary.recipes_replaced],
    ['Itens de receita', summary.recipe_items_created],
    ['Clientes criados', summary.customers_created],
    ['Clientes atualizados', summary.customers_updated],
    ['Pedidos criados', summary.orders_created],
    ['Pedidos pagos', summary.orders_paid],
    ['Pedidos pendentes', summary.orders_pending],
    ['Pedidos cancelados', summary.orders_cancelled],
    ['Itens de pedido', summary.order_items_created],
    ['Pedidos com estoque baixado', summary.orders_stock_deducted],
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold">{value}</p>
        </div>
      ))}
    </div>
  )
}

export function ImportMasterForm() {
  const [jsonText, setJsonText] = useState(EXAMPLE_JSON)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [issues, setIssues] = useState<ImportIssue[]>([])
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [status, setStatus] = useState<Status>({
    type: 'idle',
    message: 'Cole o JSON e valide antes de importar.',
  })
  const [validatedText, setValidatedText] = useState('')
  const [isPending, startTransition] = useTransition()

  const canImport = useMemo(
    () => preview !== null && issues.length === 0 && validatedText === jsonText,
    [issues.length, jsonText, preview, validatedText],
  )

  function handleValidate() {
    setSummary(null)
    startTransition(async () => {
      const result = await validateMasterImportJson(jsonText)
      setPreview(result.preview ?? null)
      setIssues(result.issues ?? [])
      setValidatedText(result.success ? jsonText : '')
      setStatus({
        type: result.success ? 'success' : 'error',
        message: result.success
          ? 'JSON validado. Confira o preview antes de importar.'
          : result.error ?? 'Corrija os erros antes de importar.',
      })
    })
  }

  function handleImport() {
    setSummary(null)
    startTransition(async () => {
      const result = await importMasterJson(jsonText)
      setPreview(result.data?.preview ?? preview)
      setIssues(result.data?.issues ?? [])
      setSummary(result.data?.summary ?? null)
      setValidatedText(result.success ? jsonText : '')
      setStatus({
        type: result.success ? 'success' : result.data?.issues.length ? 'warning' : 'error',
        message: result.success
          ? 'Importação concluída.'
          : result.error ?? 'Não foi possível importar os dados.',
      })
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="size-4" />
              JSON de importação
            </CardTitle>
            <CardDescription>Confira os dados antes de importar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={jsonText}
              onChange={(event) => {
                setJsonText(event.target.value)
                setValidatedText('')
              }}
              className="min-h-[520px] font-mono text-xs leading-relaxed"
              spellCheck={false}
              aria-label="JSON para importação"
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {status.type === 'success' ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : status.type === 'error' || status.type === 'warning' ? (
                  <AlertCircle className="size-4 text-destructive" />
                ) : (
                  <FileJson className="size-4" />
                )}
                <span>{status.message}</span>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleValidate}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <SearchCheck className="size-4" />
                  )}
                  Validar
                </Button>
                <Button
                  type="button"
                  onClick={handleImport}
                  disabled={isPending || !canImport}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Importar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <IssuesList issues={issues} />

        {summary && (
          <Card>
            <CardHeader>
              <CardTitle>Resumo da importação</CardTitle>
              <CardDescription>Resultado aplicado na base da empresa atual.</CardDescription>
            </CardHeader>
            <CardContent>
              <SummaryCards summary={summary} />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Preview</h2>
          <p className="text-sm text-muted-foreground">
            Ingredientes, compras, produtos, fichas técnicas, clientes e pedidos detectados.
          </p>
        </div>
        {preview ? <PreviewTables preview={preview} /> : <EmptyPreviewMessage />}
      </div>
    </div>
  )
}
