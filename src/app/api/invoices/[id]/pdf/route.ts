export const runtime = 'nodejs'

import * as React from 'react'
import { pdf } from '@react-pdf/renderer'
import { auth } from '@clerk/nextjs/server'
import { getInvoiceForPdf } from '@/lib/invoices/pdf-data'
import { InvoicePdfDocument } from '@/components/invoices/invoice-pdf'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { orgId } = await auth()
    if (!orgId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const workOrder = searchParams.get('workOrder') === 'true'

    const data = await getInvoiceForPdf(orgId, id)
    if (!data) {
      return new Response('Not found', { status: 404 })
    }

    const element = React.createElement(InvoicePdfDocument, { data, workOrder })
    let pdfBuffer: Buffer
    try {
      const blob = await pdf(element as any).toBlob() as Blob
      pdfBuffer = Buffer.from(await blob.arrayBuffer())
    } catch {
      // Fallback if toBlob fails in this Node.js environment
      pdfBuffer = (await pdf(element as any).toBuffer()) as any as Buffer
    }

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${data.invoiceNo}.pdf"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF generation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
