'use client'

import { createTechDb, type OutboxItem, type CachedJob, type CachedEquipment, type CachedCustomer, type CachedLocation, type CachedEstimate, type CachedInvoice } from './dexie'
import {
  transitionJobStatusAction,
  listTechJobsAction,
  getJobSignatureUploadUrlAction,
  confirmJobSignatureAction,
  saveCompletionNotesAction,
  getEquipmentByServiceLocationAction,
} from '@/app/(tech)/tech/jobs/actions'
import {
  getJobPhotoUploadUrlAction,
  confirmJobPhotoAction,
} from '@/app/(app)/jobs/actions'
import {
  createEstimateAction,
  convertEstimateToJobAction,
  listTechEstimatesAction,
} from '@/app/(tech)/tech/estimates/actions'
import {
  createInvoiceFromJobAction,
  sendCustomerCommunicationAction,
  listTechInvoicesAction,
} from '@/app/(tech)/tech/invoices/actions'
import {
  listTechCustomersAction,
  listTechServiceLocationsAction,
} from '@/app/(tech)/tech/customers/actions'
import { createBrowserClient } from '@/lib/supabase/browser'
import { toISODate, parseCalendarDate } from '@/lib/utils'

export interface StatusUpdatePayload {
  jobId: string
  toStatus: string
}

export interface PhotoPayload {
  jobId: string
  filename: string
  fileSize: number
  blob: Blob
}

export interface SignaturePayload {
  jobId: string
  filename: string
  fileSize: number
  blob: Blob
  signedBy: string
  signatureType: 'start' | 'complete'
}

export interface NotePayload {
  jobId: string
  notes: string
}

export interface EstimateCreatePayload {
  input: {
    customerId: string
    serviceLocationId: string | null
    contactName: string | null
    contactPhone: string | null
    description: string
    lineItems: Array<{ name: string; qty: string; unitPrice: string }>
    followUpDate: string | null
    expiryDate: string | null
    notes: string | null
    internalNotes: string | null
  }
}

export interface EstimateConversionPayload {
  estimateId: string
}

export interface InvoiceCreatePayload {
  jobId: string
}

export interface SendRecordPayload {
  kind: 'estimate' | 'invoice'
  refId: string
  channel: 'email' | 'sms'
}

export interface ManualPaymentPayload {
  invoiceId: string
  method: 'cash' | 'check'
  note: string
}

export class DeferSyncError extends Error {
  constructor(message = 'Deferred until backend feature is available') {
    super(message)
    this.name = 'DeferSyncError'
  }
}

export async function enqueueOutboxItem(
  orgId: string,
  item: Pick<OutboxItem, 'type' | 'payload'>,
): Promise<void> {
  const db = createTechDb(orgId)
  await db.open()
  await db.outbox.add({
    id: crypto.randomUUID(),
    ...item,
    createdAt: Date.now(),
    retryCount: 0,
    syncStatus: 'pending',
  } as OutboxItem)
}

export async function flushOutbox(orgId: string, userId: string): Promise<void> {
  const db = createTechDb(orgId)
  await db.open()
  const pending = await db.outbox.where('syncStatus').equals('pending').sortBy('createdAt')

  const finalStatusUpdate = new Map<string, { index: number; item: OutboxItem }>()
  pending.forEach((item, idx) => {
    if (item.type === 'job_status_update') {
      const payload = item.payload as StatusUpdatePayload
      finalStatusUpdate.set(payload.jobId, { index: idx, item })
    }
  })

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i]

    if (item.type === 'job_status_update') {
      const payload = item.payload as StatusUpdatePayload
      const final = finalStatusUpdate.get(payload.jobId)
      if (final && final.index !== i) {
        await db.outbox.update(item.id, { syncStatus: 'synced' })
        continue
      }
    }

    await db.outbox.update(item.id, { syncStatus: 'syncing' })

    try {
      if (item.type === 'job_status_update') {
        const payload = item.payload as StatusUpdatePayload
        const result = await transitionJobStatusAction(payload.jobId, payload.toStatus)
        if ('error' in result && result.error) {
          throw new Error(result.error)
        }
      } else if (item.type === 'job_photo') {
        await syncPhoto(item)
      } else if (item.type === 'job_signature') {
        await syncSignature(item)
      } else if (item.type === 'job_note') {
        await syncNote(item)
      } else if (item.type === 'estimate_create') {
        await syncEstimateCreate(item)
      } else if (item.type === 'estimate_conversion') {
        await syncEstimateConversion(item)
      } else if (item.type === 'invoice_create') {
        await syncInvoiceCreate(item)
      } else if (item.type === 'send_record') {
        await syncSendRecord(item)
      } else if (item.type === 'manual_payment') {
        await syncManualPayment(item)
      }
      await db.outbox.update(item.id, { syncStatus: 'synced' })
    } catch (err) {
      if (err instanceof DeferSyncError) {
        await db.outbox.update(item.id, { syncStatus: 'pending' })
        continue
      }

      const message = err instanceof Error ? err.message : String(err)
      const illegal = message.includes('Illegal transition')
      await db.outbox.update(item.id, {
        syncStatus: 'failed',
        retryCount: item.retryCount + 1,
        error: message,
      })
      if (illegal) {
        console.warn('Illegal transition surfaced to technician', {
          jobId: (item.payload as StatusUpdatePayload).jobId,
          message,
        })
      }
    }
  }
}

async function syncEstimateCreate(item: OutboxItem): Promise<void> {
  const payload = item.payload as EstimateCreatePayload
  const result = await createEstimateAction(payload.input)
  if (!result.success) {
    if (result.error === 'Estimates are not available yet.') {
      throw new DeferSyncError(result.error)
    }
    throw new Error(result.error)
  }
}

async function syncEstimateConversion(item: OutboxItem): Promise<void> {
  const payload = item.payload as EstimateConversionPayload
  const result = await convertEstimateToJobAction(payload.estimateId)
  if (!result.success) {
    if (result.error === 'Estimates are not available yet.') {
      throw new DeferSyncError(result.error)
    }
    throw new Error(result.error)
  }
}

async function syncInvoiceCreate(item: OutboxItem): Promise<void> {
  const payload = item.payload as InvoiceCreatePayload
  const result = await createInvoiceFromJobAction(payload.jobId)
  if (!result.success) {
    if (result.error === 'Invoices are not available yet.') {
      throw new DeferSyncError(result.error)
    }
    throw new Error(result.error)
  }
}

async function syncSendRecord(item: OutboxItem): Promise<void> {
  const payload = item.payload as SendRecordPayload
  const result = await sendCustomerCommunicationAction({
    kind: payload.kind,
    refId: payload.refId,
    channel: payload.channel,
    to: '',
  })
  if (!result.success) {
    if (result.error === 'Sending is not available yet.') {
      throw new DeferSyncError(result.error)
    }
    throw new Error(result.error)
  }
}

async function syncManualPayment(item: OutboxItem): Promise<void> {
  const payload = item.payload as ManualPaymentPayload
  const result = await sendCustomerCommunicationAction({
    kind: 'invoice',
    refId: payload.invoiceId,
    channel: 'email',
    to: '',
    subject: `Manual ${payload.method} payment note`,
    body: payload.note,
  })
  if (!result.success) {
    if (result.error === 'Sending is not available yet.') {
      throw new DeferSyncError(result.error)
    }
    throw new Error(result.error)
  }
}

async function syncPhoto(item: OutboxItem): Promise<void> {
  const payload = item.payload as PhotoPayload
  const { jobId, filename, fileSize, blob } = payload

  const urlResult = await getJobPhotoUploadUrlAction(jobId, filename, fileSize)
  if ('error' in urlResult && urlResult.error) {
    throw new Error(urlResult.error)
  }
  if (!urlResult.signedUrl || !urlResult.path) {
    throw new Error('Missing signed URL or path')
  }

  const upload = await fetch(urlResult.signedUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'content-type': blob.type || 'application/octet-stream' },
  })
  if (!upload.ok) {
    throw new Error(`Direct upload failed: ${upload.status} ${upload.statusText}`)
  }

  const confirmResult = await confirmJobPhotoAction(jobId, urlResult.path)
  if ('error' in confirmResult && confirmResult.error) {
    throw new Error(confirmResult.error)
  }
}

async function syncSignature(item: OutboxItem): Promise<void> {
  const payload = item.payload as SignaturePayload
  const { jobId, filename, fileSize, blob, signedBy, signatureType } = payload

  const urlResult = await getJobSignatureUploadUrlAction(jobId, filename, fileSize)
  if ('error' in urlResult && urlResult.error) {
    throw new Error(urlResult.error)
  }
  if (!urlResult.signedUrl || !urlResult.path) {
    throw new Error('Missing signed URL or path')
  }

  const upload = await fetch(urlResult.signedUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'content-type': blob.type || 'application/octet-stream' },
  })
  if (!upload.ok) {
    throw new Error(`Direct upload failed: ${upload.status} ${upload.statusText}`)
  }

  const confirmResult = await confirmJobSignatureAction(jobId, urlResult.path, signedBy, signatureType)
  if ('error' in confirmResult && confirmResult.error) {
    throw new Error(confirmResult.error)
  }
}

async function syncNote(item: OutboxItem): Promise<void> {
  const payload = item.payload as NotePayload
  const { jobId, notes } = payload

  const result = await saveCompletionNotesAction(jobId, notes)
  if ('error' in result && result.error) {
    throw new Error(result.error)
  }
}

export async function hydrateTechData(orgId: string, userId: string): Promise<void> {
  const db = createTechDb(orgId)
  await db.open()

  const [
    { rows: jobRows },
    { rows: customerRows },
    { rows: locationRows },
    estimatesResult,
    invoicesResult,
  ] = await Promise.all([
    listTechJobsAction(orgId, userId),
    listTechCustomersAction(orgId, userId),
    listTechServiceLocationsAction(orgId, userId),
    listTechEstimatesAction(orgId, userId),
    listTechInvoicesAction(orgId, userId),
  ])

  const cachedJobs: CachedJob[] = jobRows.map((row) => ({
    id: row.id,
    tenantId: orgId,
    jobNo: row.jobNo,
    customerId: row.customerId,
    contactId: (row as { contactId?: string | null }).contactId ?? null,
    serviceLocationId: (row as { serviceLocationId?: string | null }).serviceLocationId ?? null,
    status: row.status,
    description: row.description,
    startDate: row.startDate ? toISODate(parseCalendarDate(row.startDate)!) : null,
    arrivalWindowStart: (row as { arrivalWindowStart?: string | null }).arrivalWindowStart ?? null,
    arrivalWindowEnd: (row as { arrivalWindowEnd?: string | null }).arrivalWindowEnd ?? null,
    notesForTechs: (row as { notesForTechs?: string | null }).notesForTechs ?? null,
    completionNotes: (row as { completionNotes?: string | null }).completionNotes ?? null,
    assigneeUserIds: [userId],
  }))
  await db.jobs.clear()
  await db.jobs.bulkPut(cachedJobs)

  const cachedCustomers: CachedCustomer[] = customerRows.map((row) => ({
    id: row.id,
    tenantId: orgId,
    name: row.name,
    accountNo: row.accountNo ?? null,
    primaryPhone: row.primaryPhone ?? null,
    primaryCity: row.primaryCity ?? null,
  }))
  await db.customers.clear()
  await db.customers.bulkPut(cachedCustomers)

  const cachedLocations: CachedLocation[] = locationRows.map((row) => ({
    id: row.id,
    tenantId: orgId,
    customerId: row.customerId,
    name: row.name ?? null,
    addressLine1: row.addressLine1 ?? null,
    addressLine2: row.addressLine2 ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    postalCode: row.postalCode ?? null,
    country: row.country ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    gated: row.gated ?? false,
  }))
  await db.serviceLocations.clear()
  await db.serviceLocations.bulkPut(cachedLocations)

  if (!estimatesResult.error) {
    const cachedEstimates: CachedEstimate[] = estimatesResult.rows.map((row) => ({
      id: row.id,
      tenantId: orgId,
      status: row.status,
      customerId: row.customerId,
      customerName: row.customerName ?? null,
      description: row.description ?? null,
      value: row.value ?? null,
      followUpDate: row.followUpDate ?? null,
      expiryDate: row.expiryDate ?? null,
      notes: row.notes ?? null,
      createdAt: row.createdAt ?? null,
    }))
    await db.estimates.clear()
    await db.estimates.bulkPut(cachedEstimates)
  }

  if (!invoicesResult.error) {
    const cachedInvoices: CachedInvoice[] = invoicesResult.rows.map((row) => ({
      id: row.id,
      tenantId: orgId,
      jobId: row.jobId ?? '',
      customerId: row.customerId ?? '',
      customerName: row.customerName ?? null,
      invoiceNo: row.invoiceNo ?? null,
      status: row.status,
      total: row.total ?? null,
      balance: row.balance ?? null,
      issuedAt: row.issuedAt ?? null,
      dueAt: row.dueAt ?? null,
      paidAt: row.paidAt ?? null,
      notes: row.notes ?? null,
    }))
    await db.invoices.clear()
    await db.invoices.bulkPut(cachedInvoices)
  }

  const locationIds = Array.from(
    new Set(cachedJobs.map((job) => job.serviceLocationId).filter(Boolean) as string[]),
  )

  if (locationIds.length > 0) {
    await db.equipment.clear()
    for (const locationId of locationIds) {
      const rows = await getEquipmentByServiceLocationAction(orgId, locationId)
      const mapped: CachedEquipment[] = rows.map((row) => ({
        id: row.id,
        tenantId: orgId,
        serviceLocationId: row.serviceLocationId,
        kind: row.kind,
        brand: row.brand ?? null,
        installDate: row.installDate ? toISODate(new Date(row.installDate)) : null,
        warrantyExpires: row.warrantyExpires ? toISODate(new Date(row.warrantyExpires)) : null,
        notes: row.notes ?? null,
        widthFt: row.widthFt ? String(row.widthFt) : null,
        heightFt: row.heightFt ? String(row.heightFt) : null,
        material: row.material ?? null,
        style: row.style ?? null,
        color: row.color ?? null,
        modelSeries: row.modelSeries ?? null,
        model: row.model ?? null,
        hp: row.hp ? String(row.hp) : null,
        serial: row.serial ?? null,
        wireSize: row.wireSize ? String(row.wireSize) : null,
        insideDiameter: row.insideDiameter ? String(row.insideDiameter) : null,
        length: row.length ? String(row.length) : null,
        windDirection: row.windDirection,
        cycleRating: row.cycleRating ?? null,
      }))
      if (mapped.length > 0) {
        await db.equipment.bulkPut(mapped)
      }
    }
  }
}

export function startSyncLoop(orgId: string, userId: string): () => void {
  const flush = () => {
    void flushOutbox(orgId, userId)
  }
  const hydrate = () => {
    void hydrateTechData(orgId, userId)
  }

  const onOnline = () => { flush(); hydrate() }
  const onFocus = () => { flush(); hydrate() }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      flush()
      hydrate()
    }
  }

  window.addEventListener('online', onOnline)
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onVisibility)

  flush()
  hydrate()

  const client = createBrowserClient()
  const channel = client.channel(`dispatch:${orgId}`, {
    config: { broadcast: { self: false } },
  })

  channel.on('broadcast', { event: 'job-updated' }, () => { hydrate() })
  channel.on('broadcast', { event: 'job-assigned' }, () => { hydrate() })
  channel.on('broadcast', { event: 'job-unassigned' }, () => { hydrate() })
  channel.on('broadcast', { event: 'job-status-changed' }, () => { hydrate() })

  channel.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR') {
      console.warn('Tech dispatch realtime channel error', { orgId, err })
    } else if (status === 'CLOSED') {
      console.warn('Tech dispatch realtime channel closed', { orgId })
    }
  })

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisibility)
    client.removeChannel(channel)
  }
}
