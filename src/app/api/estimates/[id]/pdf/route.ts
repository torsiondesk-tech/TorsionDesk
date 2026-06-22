export const runtime = 'nodejs'

import * as React from 'react'
import { pdf } from '@react-pdf/renderer'
import { auth } from '@clerk/nextjs/server'
import { getEstimateForPdf } from '@/lib/estimates/pdf-data'
import { EstimatePdfDocument } from '@/components/pdf/estimate-pdf'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { orgId } = await auth()
    if (!orgId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { id } = await params
    const data = await getEstimateForPdf(orgId, id)
    if (!data) {
      return new Response('Not found', { status: 404 })
    }

    const element = React.createElement(EstimatePdfDocument, { data })
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
        'Content-Disposition': `attachment; filename="estimate-${data.estimateNo}.pdf"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF generation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
