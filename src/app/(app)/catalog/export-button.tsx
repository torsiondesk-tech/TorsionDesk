'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { exportCatalogCsv } from './actions'

export function ExportButton({ kind }: { kind: 'product' | 'service' }) {
  const [pending, setPending] = useState(false)

  const handleExport = async () => {
    setPending(true)
    try {
      const csv = await exportCatalogCsv(kind)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `catalog-${kind}s-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={pending}
      aria-label="Export CSV"
    >
      <Download className="size-4" />
      {pending ? 'Exporting…' : 'Export CSV'}
    </Button>
  )
}
