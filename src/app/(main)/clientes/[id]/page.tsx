import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getCustomer } from '@/actions/customers'
import { CustomerForm } from '@/components/customers/customer-form'
import { Button } from '@/components/ui/button'

interface EditCustomerPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditCustomerPage({
  params,
}: EditCustomerPageProps) {
  const { id } = await params
  const customer = await getCustomer(id)

  if (!customer) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" render={<Link href="/clientes" />}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Editar cliente</h1>
          <p className="text-sm text-muted-foreground">
            Atualize contato, endereço e observações.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <CustomerForm customer={customer} />
      </div>
    </div>
  )
}
