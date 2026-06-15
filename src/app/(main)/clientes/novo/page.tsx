import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { CustomerForm } from '@/components/customers/customer-form'
import { Button } from '@/components/ui/button'

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" render={<Link href="/clientes" />}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo cliente</h1>
          <p className="text-sm text-muted-foreground">
            Compras e histórico serão preenchidos futuramente pelos pedidos.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <CustomerForm />
      </div>
    </div>
  )
}
