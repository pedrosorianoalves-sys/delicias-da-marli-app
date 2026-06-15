'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  downloadCsv,
  downloadPdf,
  downloadXlsx,
  type ExportSection,
} from '@/lib/export-files'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ExportButtonsProps = {
  title: string
  sections: ExportSection[]
  className?: string
}

type ExportType = 'csv' | 'xlsx' | 'pdf'

export function ExportButtons({ title, sections, className }: ExportButtonsProps) {
  const [active, setActive] = useState<ExportType | null>(null)
  const hasRows = sections.some((section) => section.rows.length > 0)

  function handleExport(type: ExportType) {
    if (!hasRows) {
      toast.error('Não há dados para exportar.')
      return
    }

    setActive(type)

    try {
      if (type === 'csv') downloadCsv(title, sections)
      if (type === 'xlsx') downloadXlsx(title, sections)
      if (type === 'pdf') downloadPdf(title, sections)
      toast.success('Arquivo exportado.')
    } catch (error) {
      console.error('export error:', error)
      toast.error('Erro ao exportar arquivo.')
    } finally {
      setActive(null)
    }
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasRows || active !== null}
        onClick={() => handleExport('csv')}
      >
        {active === 'csv' ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileText className="size-3.5" />
        )}
        Exportar CSV
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasRows || active !== null}
        onClick={() => handleExport('xlsx')}
      >
        {active === 'xlsx' ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="size-3.5" />
        )}
        Exportar Excel
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasRows || active !== null}
        onClick={() => handleExport('pdf')}
      >
        {active === 'pdf' ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        Exportar PDF
      </Button>
    </div>
  )
}
