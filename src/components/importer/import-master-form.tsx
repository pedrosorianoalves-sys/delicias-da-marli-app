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
  "ingredients": [
    {
      "name": "Açúcar",
      "unit": "kg",
      "initial_stock": 10,
      "minimum_stock": 2,
      "supplier": "Mercado",
      "purchase": {
        "quantity": 10,
        "unit": "kg",
        "total_price": 34.9,
        "supplier": "Mercado"
      }
    }
  ],
  "products": [
    {
      "name": "Bolo de pote chocolate",
      "category": "Bolo de pote",
      "description": "Bolo de pote sabor chocolate",
      "sale_price": 12,
      "active": true,
      "recipe": [
        {
          "ingredient": "Açúcar",
          "quantity": 200,
          "unit": "g"
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
            Ingredientes, compras, produtos e fichas técnicas detectados.
          </p>
        </div>
        {preview ? <PreviewTables preview={preview} /> : <EmptyPreviewMessage />}
      </div>
    </div>
  )
}
