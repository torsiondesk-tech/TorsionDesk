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
  'job_create',
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
  /** Monotonic enqueue sequence used to keep coalescing stable when multiple items share the same millisecond. */
  seq: number
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
  primaryLocationId?: string | null
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
  // display fields cached from the server join
  customerName: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  contactPhone: string | null
  contactEmail: string | null
  contactFirstName: string | null
  contactLastName: string | null
  lineItems: CachedLineItem[]
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

export interface CachedContact {
  id: string
  tenantId: string
  customerId: string
  firstName: string
  lastName: string | null
  jobTitle: string | null
  primaryPhone: string | null
  primaryEmail: string | null
}

export interface CachedJobCategory {
  id: string
  tenantId: string
  name: string
  parentId: string | null
}

export interface CachedReferralSource {
  id: string
  tenantId: string
  name: string
}

export interface CachedTaxItem {
  id: string
  tenantId: string
  name: string
  rate: string | null
}

export interface CachedTag {
  id: string
  tenantId: string
  name: string
  color: string | null
}

export interface CachedOrgMember {
  id: string
  tenantId: string
  label: string
  role: string | null
}

export interface CachedSalesRep {
  id: string
  tenantId: string
  name: string
}

export interface CachedProductCategory {
  id: string
  tenantId: string
  name: string
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

export interface CachedLineItem {
  id: string
  type: 'product' | 'service' | 'discount' | 'expense'
  refId: string | null
  title: string | null
  description: string | null
  qty: string | null
  rate: string | null
  cost: string | null
  taxItemId: string | null
  sortOrder: number | null
}

export interface CachedEstimate {
  id: string
  tenantId: string
  estimateNo: number
  status: string
  customerId: string
  customerName: string | null
  description: string | null
  value: number | null
  followUpDate: string | null
  expiryDate: string | null
  notes: string | null
  createdAt: string | null
  opportunityRating: number | null
  // Extended fields for edit form
  contactId: string | null
  serviceLocationId: string | null
  categoryId: string | null
  poNumber: string | null
  referralSourceId: string | null
  assignedAgentId: string | null
  onSiteDate: string | null
  arrivalWindowStart: string | null
  arrivalWindowEnd: string | null
  notesForTechs: string | null
  internalNotes: string | null
  requestedOn: string | null
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

/** Lightweight record of a signature that has been confirmed on the server. Cached for offline display so the pad doesn't appear blank when connectivity drops. Signed URLs are NOT stored here — they expire and must be fetched fresh when online. */
export interface CachedSignatureMeta {
  id: string
  jobId: string
  signatureType: 'start' | 'complete'
  signedBy: string | null
  capturedBy: string | null
}

export class TechSyncDb extends Dexie {
  customers!: EntityTable<CachedCustomer, 'id'>
  jobs!: EntityTable<CachedJob, 'id'>
  serviceLocations!: EntityTable<CachedLocation, 'id'>
  contacts!: EntityTable<CachedContact, 'id'>
  jobCategories!: EntityTable<CachedJobCategory, 'id'>
  referralSources!: EntityTable<CachedReferralSource, 'id'>
  taxItems!: EntityTable<CachedTaxItem, 'id'>
  tags!: EntityTable<CachedTag, 'id'>
  orgMembers!: EntityTable<CachedOrgMember, 'id'>
  salesReps!: EntityTable<CachedSalesRep, 'id'>
  productCategories!: EntityTable<CachedProductCategory, 'id'>
  equipment!: EntityTable<CachedEquipment, 'id'>
  estimates!: EntityTable<CachedEstimate, 'id'>
  invoices!: EntityTable<CachedInvoice, 'id'>
  signatureMeta!: EntityTable<CachedSignatureMeta, 'id'>
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
    // v4: added display fields to CachedJob (customerName, address, phone, email)
    this.version(4).stores({
      jobs: 'id, tenantId, status, startDate, [tenantId+assigneeUserIds]',
      serviceLocations: 'id, tenantId, customerId, [tenantId+id]',
      equipment: 'id, tenantId, serviceLocationId, [tenantId+serviceLocationId]',
      customers: 'id, tenantId, [tenantId+id]',
      estimates: 'id, tenantId, status, customerId, createdAt, [tenantId+status]',
      invoices: 'id, tenantId, status, jobId, [tenantId+status]',
      outbox: 'id, type, syncStatus, createdAt',
    })
    // v5: add stable enqueue sequence to outbox for deterministic coalescing
    this.version(5).stores({
      jobs: 'id, tenantId, status, startDate, [tenantId+assigneeUserIds]',
      serviceLocations: 'id, tenantId, customerId, [tenantId+id]',
      equipment: 'id, tenantId, serviceLocationId, [tenantId+serviceLocationId]',
      customers: 'id, tenantId, [tenantId+id]',
      estimates: 'id, tenantId, status, customerId, createdAt, [tenantId+status]',
      invoices: 'id, tenantId, status, jobId, [tenantId+status]',
      outbox: 'id, type, syncStatus, createdAt, seq',
    })
    // v6: cache server-confirmed signature metadata so the Sign tab doesn't show blank pads offline
    this.version(6).stores({
      jobs: 'id, tenantId, status, startDate, [tenantId+assigneeUserIds]',
      serviceLocations: 'id, tenantId, customerId, [tenantId+id]',
      equipment: 'id, tenantId, serviceLocationId, [tenantId+serviceLocationId]',
      customers: 'id, tenantId, [tenantId+id]',
      estimates: 'id, tenantId, status, customerId, createdAt, [tenantId+status]',
      invoices: 'id, tenantId, status, jobId, [tenantId+status]',
      signatureMeta: 'id, jobId, [jobId+signatureType]',
      outbox: 'id, type, syncStatus, createdAt, seq',
    })
    // v7: added contactFirstName + contactLastName to CachedJob for immediate contact name updates
    this.version(7).stores({
      jobs: 'id, tenantId, status, startDate, [tenantId+assigneeUserIds]',
      serviceLocations: 'id, tenantId, customerId, [tenantId+id]',
      equipment: 'id, tenantId, serviceLocationId, [tenantId+serviceLocationId]',
      customers: 'id, tenantId, [tenantId+id]',
      estimates: 'id, tenantId, status, customerId, createdAt, [tenantId+status]',
      invoices: 'id, tenantId, status, jobId, [tenantId+status]',
      signatureMeta: 'id, jobId, [jobId+signatureType]',
      outbox: 'id, type, syncStatus, createdAt, seq',
    })
    // v8: cache job line items so the tech PWA Line Items card displays live data
    this.version(8).stores({
      jobs: 'id, tenantId, status, startDate, [tenantId+assigneeUserIds]',
      serviceLocations: 'id, tenantId, customerId, [tenantId+id]',
      equipment: 'id, tenantId, serviceLocationId, [tenantId+serviceLocationId]',
      customers: 'id, tenantId, [tenantId+id]',
      estimates: 'id, tenantId, status, customerId, createdAt, [tenantId+status]',
      invoices: 'id, tenantId, status, jobId, [tenantId+status]',
      signatureMeta: 'id, jobId, [jobId+signatureType]',
      outbox: 'id, type, syncStatus, createdAt, seq',
    })
    // v9: cache reference data needed for the full estimate form
    this.version(9).stores({
      jobs: 'id, tenantId, status, startDate, [tenantId+assigneeUserIds]',
      serviceLocations: 'id, tenantId, customerId, [tenantId+id]',
      contacts: 'id, tenantId, customerId, [tenantId+customerId]',
      jobCategories: 'id, tenantId, [tenantId+id]',
      referralSources: 'id, tenantId, [tenantId+id]',
      taxItems: 'id, tenantId, [tenantId+id]',
      tags: 'id, tenantId, [tenantId+id]',
      orgMembers: 'id, tenantId, [tenantId+id]',
      salesReps: 'id, tenantId, [tenantId+id]',
      productCategories: 'id, tenantId, [tenantId+id]',
      equipment: 'id, tenantId, serviceLocationId, [tenantId+serviceLocationId]',
      customers: 'id, tenantId, [tenantId+id]',
      estimates: 'id, tenantId, status, customerId, createdAt, [tenantId+status]',
      invoices: 'id, tenantId, status, jobId, [tenantId+status]',
      signatureMeta: 'id, jobId, [jobId+signatureType]',
      outbox: 'id, type, syncStatus, createdAt, seq',
    })
  }
}

const _instances = new Map<string, TechSyncDb>()

export function createTechDb(orgId: string): TechSyncDb {
  if (!_instances.has(orgId)) {
    _instances.set(orgId, new TechSyncDb(orgId))
  }
  return _instances.get(orgId)!
}
