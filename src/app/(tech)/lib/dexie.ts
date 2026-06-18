import { Dexie, type EntityTable } from 'dexie'

export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed'

/**
 * Queued mutation types for the technician PWA offline outbox.
 *
 * The base set from CONTEXT D-16 covers the seven core mutation categories.
 * Two additions are included here:
 * - `job_signature` per RESEARCH.md Open Question A5: signature mutations need
 *   their own outbox slot, separate from job_photo, so a completed job can be
 *   signed offline and synced later.
 * - `manual_payment` per CONTEXT D-03: offline cash/check notes can be queued
 *   for later posting. Square card payments are NEVER queued because
 *   tokenization/authorization require live connectivity.
 */
export const OUTBOX_TYPES = [
  'job_status_update',
  'job_note',
  'job_photo',
  'job_signature',
  'estimate_create',
  'estimate_conversion',
  'invoice_create',
  'send_record',
  'manual_payment',
] as const

export type OutboxType = (typeof OUTBOX_TYPES)[number]

export interface OutboxItem {
  id: string
  type: OutboxType
  payload: unknown
  createdAt: number
  retryCount: number
  error?: string
  syncStatus: OutboxStatus
}

export interface CachedCustomer {
  id: string
  tenantId: string
  name: string
  accountNo: number | null
  primaryPhone: string | null
  primaryCity: string | null
}

export interface CachedJob {
  id: string
  tenantId: string
  jobNo: number
  customerId: string
  contactId: string | null
  serviceLocationId: string | null
  status: string
  description: string | null
  startDate: string | null
  arrivalWindowStart: string | null
  arrivalWindowEnd: string | null
  notesForTechs: string | null
  completionNotes: string | null
  assigneeUserIds: string[]
}

export interface CachedLocation {
  id: string
  tenantId: string
  customerId: string
  name: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  latitude: string | null
  longitude: string | null
  gated: boolean
}

export interface CachedEquipment {
  id: string
  tenantId: string
  serviceLocationId: string
  kind: 'door' | 'opener' | 'spring'
  brand: string | null
  installDate: string | null
  warrantyExpires: string | null
  notes: string | null
  // door
  widthFt: string | null
  heightFt: string | null
  material: string | null
  style: string | null
  color: string | null
  modelSeries: string | null
  // opener
  model: string | null
  hp: string | null
  serial: string | null
  // spring
  wireSize: string | null
  insideDiameter: string | null
  length: string | null
  windDirection: 'left' | 'right' | 'pair' | null
  cycleRating: number | null
}

export interface CachedEstimate {
  id: string
  tenantId: string
  status: string
  customerId: string
  customerName: string | null
  description: string | null
  value: number | null
  followUpDate: string | null
  expiryDate: string | null
  notes: string | null
  createdAt: string | null
}

export interface CachedInvoice {
  id: string
  tenantId: string
  jobId: string
  customerId: string
  customerName: string | null
  invoiceNo: string | null
  status: string
  total: number | null
  balance: number | null
  issuedAt: string | null
  dueAt: string | null
  paidAt: string | null
  notes: string | null
}

export class TechSyncDb extends Dexie {
  customers!: EntityTable<CachedCustomer, 'id'>
  jobs!: EntityTable<CachedJob, 'id'>
  serviceLocations!: EntityTable<CachedLocation, 'id'>
  equipment!: EntityTable<CachedEquipment, 'id'>
  estimates!: EntityTable<CachedEstimate, 'id'>
  invoices!: EntityTable<CachedInvoice, 'id'>
  outbox!: EntityTable<OutboxItem, 'id'>

  constructor(orgId: string) {
    super(`TechSyncDb-${orgId}`)
    this.version(1).stores({
      jobs: 'id, tenantId, status, startDate, [tenantId+assigneeUserIds]',
      serviceLocations: 'id, tenantId, customerId, [tenantId+id]',
      equipment: 'id, tenantId, serviceLocationId, [tenantId+serviceLocationId]',
      outbox: 'id, type, syncStatus, createdAt',
    })
    this.version(2).stores({
      customers: 'id, tenantId, [tenantId+id]',
      estimates: 'id, tenantId, status, customerId, createdAt, [tenantId+status]',
    })
    this.version(3).stores({
      jobs: 'id, tenantId, status, startDate, [tenantId+assigneeUserIds]',
      serviceLocations: 'id, tenantId, customerId, [tenantId+id]',
      equipment: 'id, tenantId, serviceLocationId, [tenantId+serviceLocationId]',
      customers: 'id, tenantId, [tenantId+id]',
      estimates: 'id, tenantId, status, customerId, createdAt, [tenantId+status]',
      invoices: 'id, tenantId, status, jobId, [tenantId+status]',
      outbox: 'id, type, syncStatus, createdAt',
    })
  }
}

export function createTechDb(orgId: string): TechSyncDb {
  return new TechSyncDb(orgId)
}
