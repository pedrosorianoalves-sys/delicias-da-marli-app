import Link from 'next/link'
import { Plus } from 'lucide-react'

import { getCustomers } from '@/actions/customers'
import { CustomerTable } from '@/components/customers/customer-table'
import { ExportButtons } from '@/components/export/export-buttons'
import { Button } from '@/components/ui/button'
import { customersExportSections } from '@/lib/export-sections'

export default async function CustomersPage() {
  const customers = await getCustomers()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre contatos, endereços e observações de atendimento.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ExportButtons
            title="Clientes"
            sections={customersExportSections(customers)}
          />
          <Button render={<Link href="/clientes/novo" />}>
            <Plus className="size-4" />
            Novo cliente
          </Button>
        </div>
      </div>

      <CustomerTable customers={customers} />
    </div>
  )
}
