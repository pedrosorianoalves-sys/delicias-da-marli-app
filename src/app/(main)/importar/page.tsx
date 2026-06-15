import { ImportMasterForm } from '@/components/importer/import-master-form'

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar JSON</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre ingredientes, compras, produtos e fichas técnicas em massa.
        </p>
      </div>

      <ImportMasterForm />
    </div>
  )
}
