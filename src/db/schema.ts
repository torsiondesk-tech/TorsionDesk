import {
  pgTable,
  text,
  pgPolicy,
  pgEnum,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  unique,
  foreignKey,
  index,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * `tenants` — the root tenancy table.
 *
 * `id` IS the Clerk organization id (`o.id` in the JWT v2 claim, per RESEARCH A4).
 * Clerk org ids are text strings (e.g. `org_...`), NOT UUIDs — hence `text` PK.
 * Using the org id directly as the PK gives a 1:1 mapping to the tenant GUC that
 * `withTenant` sets, so RLS can compare `id` to `app.current_tenant_id` directly.
 *
 * The RLS policy is fail-closed: `current_setting('app.current_tenant_id', true)`
 * returns NULL (not an error) when the GUC is unset, so an unscoped query matches
 * no rows (RESEARCH Pattern 3 / T-00-01).
 */
export const tenants = pgTable(
  'tenants',
  {
    id: text('id').primaryKey(), // == Clerk org id (o.id)
    companyName: text('company_name'),
    phone: text('phone'),
    address: text('address'),
    email: text('email'),
    logoUrl: text('logo_url'),
    defaultPaymentTermsDays: integer('default_payment_terms_days').default(0),
  },
  (t) => [
    pgPolicy('tenant_self_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.id} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.id} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert

// ── Phase 1: Customers, Locations, and Equipment ───────────────────────────

export const equipmentKind = pgEnum('equipment_kind', ['door', 'opener', 'spring'])
export const windDirection = pgEnum('wind_direction', ['left', 'right', 'pair'])
export const eventKind = pgEnum('event_kind', ['job', 'estimate', 'invoice', 'payment', 'email', 'note'])
export const phoneType = pgEnum('phone_type', ['cell', 'home', 'work'])
export const emailType = pgEnum('email_type', ['work', 'personal'])

export const referralSources = pgTable(
  'referral_sources',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
  },
  (t) => [
    unique('referral_sources_tenant_name_unique').on(t.tenantId, t.name),
    // Composite unique on (tenant_id, id) so composite FKs can reference it
    unique('referral_sources_tenant_id_unique').on(t.tenantId, t.id),
    pgPolicy('referral_sources_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type ReferralSource = typeof referralSources.$inferSelect
export type NewReferralSource = typeof referralSources.$inferInsert

export const customers = pgTable(
  'customers',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    accountNo: integer('account_no').notNull(),
    name: text('name').notNull(),
    active: boolean('active').default(true),
    vip: boolean('vip').default(false),
    parentCustomerId: text('parent_customer_id'),
    assignedAgentId: text('assigned_agent_id'),
    referralSourceId: text('referral_source_id'),
    taxable: boolean('taxable').default(true),
    taxItemId: text('tax_item_id'),
    internalNotes: text('internal_notes'),
    publicNotes: text('public_notes'),
    archivedAt: timestamp('archived_at'),
    primaryLocationId: text('primary_location_id'),
    primaryContactId: text('primary_contact_id'),
    mergedInto: text('merged_into'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('customers_tenant_account_unique').on(t.tenantId, t.accountNo),
    // Composite unique on (tenant_id, id) so composite FKs from this table can reference it
    unique('customers_tenant_id_unique').on(t.tenantId, t.id),
    index('customers_name_idx').on(t.name),
    index('customers_active_idx').on(t.active),
    index('customers_created_at_idx').on(t.createdAt),
    // Composite tenant-scoped FKs so the DB enforces same-tenant references (AUDIT-014)
    foreignKey({
      columns: [t.tenantId, t.parentCustomerId],
      foreignColumns: [t.tenantId, t.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.referralSourceId],
      foreignColumns: [referralSources.tenantId, referralSources.id],
    }).onDelete('set null'),
    // Note: primaryLocationId and primaryContactId are validated at the app layer
    // to avoid circular references between customers and their child tables.
    foreignKey({
      columns: [t.tenantId, t.mergedInto],
      foreignColumns: [t.tenantId, t.id],
    }).onDelete('set null'),
    pgPolicy('customers_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert

export const contacts = pgTable(
  'contacts',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    smsConsent: boolean('sms_consent').default(true),
    billingContact: boolean('billing_contact').default(false),
    bookingContact: boolean('booking_contact').default(false),
    jobTitle: text('job_title'),
    birthday: date('birthday'),
    anniversary: date('anniversary'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    index('contacts_customer_id_idx').on(t.customerId),
    unique('contacts_tenant_id_unique').on(t.tenantId, t.id),
    // Composite tenant-scoped FK so the DB enforces same-tenant references.
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }).onDelete('cascade'),
    pgPolicy('contacts_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type Contact = typeof contacts.$inferSelect
export type NewContact = typeof contacts.$inferInsert

export const contactPhones = pgTable(
  'contact_phones',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    number: text('number').notNull(),
    ext: text('ext'),
    type: phoneType('type').notNull().default('cell'),
    isPrimary: boolean('is_primary').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    // Composite tenant-scoped FK so the DB enforces same-tenant references.
    foreignKey({
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contacts.tenantId, contacts.id],
    }).onDelete('cascade'),
    pgPolicy('contact_phones_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type ContactPhone = typeof contactPhones.$inferSelect
export type NewContactPhone = typeof contactPhones.$inferInsert

export const contactEmails = pgTable(
  'contact_emails',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    address: text('address').notNull(),
    type: emailType('type').notNull().default('work'),
    isPrimary: boolean('is_primary').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    // Composite tenant-scoped FK so the DB enforces same-tenant references.
    foreignKey({
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contacts.tenantId, contacts.id],
    }).onDelete('cascade'),
    pgPolicy('contact_emails_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type ContactEmail = typeof contactEmails.$inferSelect
export type NewContactEmail = typeof contactEmails.$inferInsert

export const serviceLocations = pgTable(
  'service_locations',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    name: text('name'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    country: text('country').default('USA'),
    gated: boolean('gated').default(false),
    latitude: numeric('latitude'),
    longitude: numeric('longitude'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    index('service_locations_customer_id_idx').on(t.customerId),
    unique('service_locations_tenant_id_unique').on(t.tenantId, t.id),
    // Composite tenant-scoped FK so the DB enforces same-tenant references.
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }).onDelete('cascade'),
    pgPolicy('service_locations_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type ServiceLocation = typeof serviceLocations.$inferSelect
export type NewServiceLocation = typeof serviceLocations.$inferInsert

export const equipment = pgTable(
  'equipment',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    serviceLocationId: text('service_location_id')
      .notNull()
      .references(() => serviceLocations.id, { onDelete: 'cascade' }),
    kind: equipmentKind('kind').notNull(),
    brand: text('brand'),
    installDate: date('install_date'),
    warrantyExpires: date('warranty_expires'),
    notes: text('notes'),
    // door
    widthFt: numeric('width_ft'),
    heightFt: numeric('height_ft'),
    material: text('material'),
    style: text('style'),
    color: text('color'),
    modelSeries: text('model_series'),
    // opener
    model: text('model'),
    hp: numeric('hp'),
    serial: text('serial'),
    // spring
    wireSize: numeric('wire_size'),
    insideDiameter: numeric('inside_diameter'),
    length: numeric('length'),
    windDirection: windDirection('wind_direction'),
    cycleRating: integer('cycle_rating'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    index('equipment_service_location_id_idx').on(t.serviceLocationId),
    // Composite tenant-scoped FK so the DB enforces same-tenant references.
    foreignKey({
      columns: [t.tenantId, t.serviceLocationId],
      foreignColumns: [serviceLocations.tenantId, serviceLocations.id],
    }).onDelete('cascade'),
    pgPolicy('equipment_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type Equipment = typeof equipment.$inferSelect
export type NewEquipment = typeof equipment.$inferInsert

export const tags = pgTable(
  'tags',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    color: text('color').default('#6366f1'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('tags_tenant_name_unique').on(t.tenantId, t.name),
    unique('tags_tenant_id_unique').on(t.tenantId, t.id),
    pgPolicy('tags_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

export const customerTags = pgTable(
  'customer_tags',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    unique('customer_tags_tenant_customer_tag_unique').on(t.tenantId, t.customerId, t.tagId),
    // Composite tenant-scoped FKs so the DB enforces same-tenant references.
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.tagId],
      foreignColumns: [tags.tenantId, tags.id],
    }).onDelete('cascade'),
    pgPolicy('customer_tags_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type CustomerTag = typeof customerTags.$inferSelect
export type NewCustomerTag = typeof customerTags.$inferInsert

export const customerEvents = pgTable(
  'customer_events',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    kind: eventKind('kind').notNull(),
    title: text('title'),
    body: text('body'),
    refId: text('ref_id'),
    occurredAt: timestamp('occurred_at').defaultNow(),
    actor: text('actor'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    index('customer_events_customer_occurred_idx').on(t.customerId, t.occurredAt),
    // Composite tenant-scoped FK so the DB enforces same-tenant references.
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }).onDelete('cascade'),
    pgPolicy('customer_events_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type CustomerEvent = typeof customerEvents.$inferSelect
export type NewCustomerEvent = typeof customerEvents.$inferInsert

// ── Phase 2: Catalog and Settings ──────────────────────────────────────────

export const productCategories = pgTable(
  'product_categories',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('product_categories_tenant_name_unique').on(t.tenantId, t.name),
    unique('product_categories_tenant_id_unique').on(t.tenantId, t.id),
    pgPolicy('product_categories_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type ProductCategory = typeof productCategories.$inferSelect
export type NewProductCategory = typeof productCategories.$inferInsert

export const jobCategories = pgTable(
  'job_categories',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    parentId: text('parent_id'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('job_categories_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.parentId],
      foreignColumns: [t.tenantId, t.id],
    }).onDelete('set null'),
    pgPolicy('job_categories_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobCategory = typeof jobCategories.$inferSelect
export type NewJobCategory = typeof jobCategories.$inferInsert

export const taxItems = pgTable(
  'tax_items',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    rate: numeric('rate'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('tax_items_tenant_id_unique').on(t.tenantId, t.id),
    pgPolicy('tax_items_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type TaxItem = typeof taxItems.$inferSelect
export type NewTaxItem = typeof taxItems.$inferInsert

export const jobSources = pgTable(
  'job_sources',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('job_sources_tenant_name_unique').on(t.tenantId, t.name),
    unique('job_sources_tenant_id_unique').on(t.tenantId, t.id),
    pgPolicy('job_sources_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobSource = typeof jobSources.$inferSelect
export type NewJobSource = typeof jobSources.$inferInsert

export const salesReps = pgTable(
  'sales_reps',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('sales_reps_tenant_name_unique').on(t.tenantId, t.name),
    // Composite unique on (tenant_id, id) so composite FKs from jobs/estimates can reference it
    unique('sales_reps_tenant_id_unique').on(t.tenantId, t.id),
    pgPolicy('sales_reps_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type SalesRep = typeof salesReps.$inferSelect
export type NewSalesRep = typeof salesReps.$inferInsert

export const services = pgTable(
  'services',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    categoryId: text('category_id'),
    name: text('name').notNull(),
    unitPrice: numeric('unit_price'),
    unitCost: numeric('unit_cost'),
    description: text('description'),
    active: boolean('active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('services_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.categoryId],
      foreignColumns: [productCategories.tenantId, productCategories.id],
    }).onDelete('set null'),
    pgPolicy('services_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type Service = typeof services.$inferSelect
export type NewService = typeof services.$inferInsert

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    categoryId: text('category_id'),
    name: text('name').notNull(),
    model: text('model'),
    sku: text('sku'),
    upc: text('upc'),
    partNo: text('part_no'),
    type: text('type'),
    unitPrice: numeric('unit_price'),
    unitCost: numeric('unit_cost'),
    active: boolean('active').default(true),
    inventoryItem: boolean('inventory_item').default(false),
    salesDescription: text('sales_description'),
    purchaseDescription: text('purchase_description'),
    vendor1Name: text('vendor1_name'),
    vendor1Price: numeric('vendor1_price'),
    vendor2Name: text('vendor2_name'),
    vendor2Price: numeric('vendor2_price'),
    vendor3Name: text('vendor3_name'),
    vendor3Price: numeric('vendor3_price'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('products_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.categoryId],
      foreignColumns: [productCategories.tenantId, productCategories.id],
    }).onDelete('set null'),
    pgPolicy('products_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert

// ── Phase 3: Jobs Core and Status FSM ──────────────────────────────────────

export const jobStatus = pgEnum('job_status', [
  'unscheduled',
  'scheduled',
  'dispatched',
  'cancelled',
  'delayed',
  'on_the_way',
  'on_site',
  'started',
  'paused',
  'resumed',
  'partially_completed',
  'completed',
  'invoiced',
  'paid_in_full',
  'job_closed',
])

export const billingType = pgEnum('billing_type', [
  'single_invoice',
  'progress_billing',
  'no_charge',
])

export const lineItemType = pgEnum('line_item_type', [
  'product',
  'service',
  'discount',
  'expense',
])

export const estimateStatus = pgEnum('estimate_status', [
  'estimate_requested',
  'estimate_provided',
  'estimate_accepted',
  'estimate_won',
  'estimate_lost',
])

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    jobNo: integer('job_no').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    serviceLocationId: text('service_location_id').references(
      () => serviceLocations.id,
      { onDelete: 'set null' },
    ),
    categoryId: text('category_id').references(() => jobCategories.id, {
      onDelete: 'set null',
    }),
    status: jobStatus('status').notNull().default('unscheduled'),
    billingType: billingType('billing_type').notNull().default('single_invoice'),
    description: text('description'),
    poNumber: text('po_number'),
    jobSourceId: text('job_source_id').references(() => jobSources.id, {
      onDelete: 'set null',
    }),
    assignedAgentId: text('assigned_agent_id'),
    estimateId: text('estimate_id').references(() => estimates.id, {
      onDelete: 'set null',
    }),
    priority: text('priority'),
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    arrivalWindowStart: timestamp('arrival_window_start'),
    arrivalWindowEnd: timestamp('arrival_window_end'),
    estimatedDuration: integer('estimated_duration'),
    multiDay: boolean('multi_day').default(false),
    notesForTechs: text('notes_for_techs'),
    completionNotes: text('completion_notes'),
    requiresFollowUp: boolean('requires_follow_up').default(false),
    isRepeating: boolean('is_repeating').default(false),
    repeatFrequency: text('repeat_frequency'),
    repeatEndDate: timestamp('repeat_end_date'),
    paymentTermsDays: integer('payment_terms_days'),
    jobPaymentMethod: text('job_payment_method'),
    checkRefNo: text('check_ref_no'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('jobs_tenant_job_no_unique').on(t.tenantId, t.jobNo),
    unique('jobs_tenant_id_unique').on(t.tenantId, t.id),
    index('jobs_status_idx').on(t.status),
    index('jobs_customer_id_idx').on(t.customerId),
    index('jobs_estimate_id_idx').on(t.estimateId),
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contacts.tenantId, contacts.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.serviceLocationId],
      foreignColumns: [serviceLocations.tenantId, serviceLocations.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.categoryId],
      foreignColumns: [jobCategories.tenantId, jobCategories.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.jobSourceId],
      foreignColumns: [jobSources.tenantId, jobSources.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.assignedAgentId],
      foreignColumns: [salesReps.tenantId, salesReps.id],
    }).onDelete('set null'),
    pgPolicy('jobs_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert

export const estimates = pgTable(
  'estimates',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    estimateNo: integer('estimate_no').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    serviceLocationId: text('service_location_id').references(
      () => serviceLocations.id,
      { onDelete: 'set null' },
    ),
    categoryId: text('category_id').references(() => jobCategories.id, {
      onDelete: 'set null',
    }),
    status: estimateStatus('status').notNull().default('estimate_requested'),
    description: text('description'),
    poNumber: text('po_number'),
    opportunityRating: integer('opportunity_rating'),
    referralSourceId: text('referral_source_id'),
    expiryDate: date('expiry_date'),
    followUpDate: date('follow_up_date'),
    onSiteDate: timestamp('on_site_date'),
    arrivalWindowStart: timestamp('arrival_window_start'),
    arrivalWindowEnd: timestamp('arrival_window_end'),
    notesForTechs: text('notes_for_techs'),
    notes: text('notes'),
    internalNotes: text('internal_notes'),
    assignedAgentId: text('assigned_agent_id'),
    requestedOn: date('requested_on'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('estimates_tenant_estimate_no_unique').on(t.tenantId, t.estimateNo),
    unique('estimates_tenant_id_unique').on(t.tenantId, t.id),
    index('estimates_status_idx').on(t.status),
    index('estimates_customer_id_idx').on(t.customerId),
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contacts.tenantId, contacts.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.serviceLocationId],
      foreignColumns: [serviceLocations.tenantId, serviceLocations.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.categoryId],
      foreignColumns: [jobCategories.tenantId, jobCategories.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.referralSourceId],
      foreignColumns: [referralSources.tenantId, referralSources.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.assignedAgentId],
      foreignColumns: [salesReps.tenantId, salesReps.id],
    }).onDelete('set null'),
    pgPolicy('estimates_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type Estimate = typeof estimates.$inferSelect
export type NewEstimate = typeof estimates.$inferInsert

export const lineItemGroups = pgTable(
  'line_item_groups',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    estimateId: text('estimate_id'),
    jobId: text('job_id'),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('line_item_groups_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.estimateId],
      foreignColumns: [estimates.tenantId, estimates.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.jobId],
      foreignColumns: [jobs.tenantId, jobs.id],
    }).onDelete('cascade'),
    check(
      'line_item_groups_owner_check',
      sql`(estimate_id IS NOT NULL)::int + (job_id IS NOT NULL)::int = 1`,
    ),
    pgPolicy('line_item_groups_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type LineItemGroup = typeof lineItemGroups.$inferSelect
export type NewLineItemGroup = typeof lineItemGroups.$inferInsert

export const jobLineItems = pgTable(
  'job_line_items',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    type: lineItemType('type'),
    refId: text('ref_id'),
    title: text('title'),
    description: text('description'),
    qty: numeric('qty'),
    rate: numeric('rate'),
    cost: numeric('cost'),
    taxItemId: text('tax_item_id').references(() => taxItems.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order'),
    groupId: text('group_id'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('job_line_items_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.jobId],
      foreignColumns: [jobs.tenantId, jobs.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.taxItemId],
      foreignColumns: [taxItems.tenantId, taxItems.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.groupId],
      foreignColumns: [lineItemGroups.tenantId, lineItemGroups.id],
    }).onDelete('set null'),
    pgPolicy('job_line_items_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobLineItem = typeof jobLineItems.$inferSelect
export type NewJobLineItem = typeof jobLineItems.$inferInsert

export const estimateLineItems = pgTable(
  'estimate_line_items',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    estimateId: text('estimate_id')
      .notNull()
      .references(() => estimates.id, { onDelete: 'cascade' }),
    groupId: text('group_id'),
    type: lineItemType('type'),
    refId: text('ref_id'),
    title: text('title'),
    description: text('description'),
    qty: numeric('qty'),
    rate: numeric('rate'),
    cost: numeric('cost'),
    taxItemId: text('tax_item_id').references(() => taxItems.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('estimate_line_items_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.estimateId],
      foreignColumns: [estimates.tenantId, estimates.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.groupId],
      foreignColumns: [lineItemGroups.tenantId, lineItemGroups.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.taxItemId],
      foreignColumns: [taxItems.tenantId, taxItems.id],
    }).onDelete('set null'),
    pgPolicy('estimate_line_items_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type EstimateLineItem = typeof estimateLineItems.$inferSelect
export type NewEstimateLineItem = typeof estimateLineItems.$inferInsert

export const jobTags = pgTable(
  'job_tags',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    unique('job_tags_tenant_job_tag_unique').on(t.tenantId, t.jobId, t.tagId),
    foreignKey({
      columns: [t.tenantId, t.jobId],
      foreignColumns: [jobs.tenantId, jobs.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.tagId],
      foreignColumns: [tags.tenantId, tags.id],
    }).onDelete('cascade'),
    pgPolicy('job_tags_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobTag = typeof jobTags.$inferSelect
export type NewJobTag = typeof jobTags.$inferInsert

export const estimateTags = pgTable(
  'estimate_tags',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    estimateId: text('estimate_id')
      .notNull()
      .references(() => estimates.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    unique('estimate_tags_tenant_estimate_tag_unique').on(t.tenantId, t.estimateId, t.tagId),
    foreignKey({
      columns: [t.tenantId, t.estimateId],
      foreignColumns: [estimates.tenantId, estimates.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.tagId],
      foreignColumns: [tags.tenantId, tags.id],
    }).onDelete('cascade'),
    pgPolicy('estimate_tags_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type EstimateTag = typeof estimateTags.$inferSelect
export type NewEstimateTag = typeof estimateTags.$inferInsert

export const jobAssignees = pgTable(
  'job_assignees',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    notify: boolean('notify').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    unique('job_assignees_tenant_job_user_unique').on(
      t.tenantId,
      t.jobId,
      t.userId,
    ),
    foreignKey({
      columns: [t.tenantId, t.jobId],
      foreignColumns: [jobs.tenantId, jobs.id],
    }).onDelete('cascade'),
    pgPolicy('job_assignees_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobAssignee = typeof jobAssignees.$inferSelect
export type NewJobAssignee = typeof jobAssignees.$inferInsert

export const estimateAssignees = pgTable(
  'estimate_assignees',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    estimateId: text('estimate_id')
      .notNull()
      .references(() => estimates.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    notify: boolean('notify').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    unique('estimate_assignees_tenant_estimate_user_unique').on(
      t.tenantId,
      t.estimateId,
      t.userId,
    ),
    foreignKey({
      columns: [t.tenantId, t.estimateId],
      foreignColumns: [estimates.tenantId, estimates.id],
    }).onDelete('cascade'),
    pgPolicy('estimate_assignees_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type EstimateAssignee = typeof estimateAssignees.$inferSelect
export type NewEstimateAssignee = typeof estimateAssignees.$inferInsert

export const jobStatusHistory = pgTable(
  'job_status_history',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    fromStatus: jobStatus('from_status'),
    toStatus: jobStatus('to_status').notNull(),
    changedBy: text('changed_by'),
    changedAt: timestamp('changed_at').defaultNow(),
  },
  (t) => [
    unique('job_status_history_tenant_id_unique').on(t.tenantId, t.id),
    index('job_status_history_job_id_idx').on(t.jobId),
    foreignKey({
      columns: [t.tenantId, t.jobId],
      foreignColumns: [jobs.tenantId, jobs.id],
    }).onDelete('cascade'),
    pgPolicy('job_status_history_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobStatusHistory = typeof jobStatusHistory.$inferSelect
export type NewJobStatusHistory = typeof jobStatusHistory.$inferInsert

export const jobSiteVisits = pgTable(
  'job_site_visits',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    status: jobStatus('status'),
    visitDate: timestamp('visit_date'),
    arrivalWindowStart: timestamp('arrival_window_start'),
    arrivalWindowEnd: timestamp('arrival_window_end'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('job_site_visits_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.jobId],
      foreignColumns: [jobs.tenantId, jobs.id],
    }).onDelete('cascade'),
    pgPolicy('job_site_visits_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobSiteVisit = typeof jobSiteVisits.$inferSelect
export type NewJobSiteVisit = typeof jobSiteVisits.$inferInsert

export const jobTasks = pgTable(
  'job_tasks',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    label: text('label'),
    done: boolean('done').default(false),
    sortOrder: integer('sort_order'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('job_tasks_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.jobId],
      foreignColumns: [jobs.tenantId, jobs.id],
    }).onDelete('cascade'),
    pgPolicy('job_tasks_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobTask = typeof jobTasks.$inferSelect
export type NewJobTask = typeof jobTasks.$inferInsert

export const estimateTasks = pgTable(
  'estimate_tasks',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    estimateId: text('estimate_id')
      .notNull()
      .references(() => estimates.id, { onDelete: 'cascade' }),
    label: text('label'),
    done: boolean('done').default(false),
    sortOrder: integer('sort_order'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('estimate_tasks_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.estimateId],
      foreignColumns: [estimates.tenantId, estimates.id],
    }).onDelete('cascade'),
    pgPolicy('estimate_tasks_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type EstimateTask = typeof estimateTasks.$inferSelect
export type NewEstimateTask = typeof estimateTasks.$inferInsert

export const jobReminders = pgTable(
  'job_reminders',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    remindAt: timestamp('remind_at'),
    note: text('note'),
    done: boolean('done').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('job_reminders_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.jobId],
      foreignColumns: [jobs.tenantId, jobs.id],
    }).onDelete('cascade'),
    pgPolicy('job_reminders_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobReminder = typeof jobReminders.$inferSelect
export type NewJobReminder = typeof jobReminders.$inferInsert

export const estimateReminders = pgTable(
  'estimate_reminders',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    estimateId: text('estimate_id')
      .notNull()
      .references(() => estimates.id, { onDelete: 'cascade' }),
    remindAt: timestamp('remind_at'),
    note: text('note'),
    done: boolean('done').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('estimate_reminders_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.estimateId],
      foreignColumns: [estimates.tenantId, estimates.id],
    }).onDelete('cascade'),
    pgPolicy('estimate_reminders_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type EstimateReminder = typeof estimateReminders.$inferSelect
export type NewEstimateReminder = typeof estimateReminders.$inferInsert

export const jobTemplates = pgTable(
  'job_templates',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    categoryId: text('category_id').references(() => jobCategories.id, {
      onDelete: 'set null',
    }),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('job_templates_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.categoryId],
      foreignColumns: [jobCategories.tenantId, jobCategories.id],
    }).onDelete('set null'),
    pgPolicy('job_templates_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobTemplate = typeof jobTemplates.$inferSelect
export type NewJobTemplate = typeof jobTemplates.$inferInsert

export const estimateTemplates = pgTable(
  'estimate_templates',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('estimate_templates_tenant_id_unique').on(t.tenantId, t.id),
    pgPolicy('estimate_templates_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type EstimateTemplate = typeof estimateTemplates.$inferSelect
export type NewEstimateTemplate = typeof estimateTemplates.$inferInsert

export const jobTemplateLineItems = pgTable(
  'job_template_line_items',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    templateId: text('template_id')
      .notNull()
      .references(() => jobTemplates.id, { onDelete: 'cascade' }),
    type: lineItemType('type'),
    refId: text('ref_id'),
    title: text('title'),
    description: text('description'),
    qty: numeric('qty'),
    rate: numeric('rate'),
    cost: numeric('cost'),
    taxItemId: text('tax_item_id').references(() => taxItems.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('job_template_line_items_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.templateId],
      foreignColumns: [jobTemplates.tenantId, jobTemplates.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.taxItemId],
      foreignColumns: [taxItems.tenantId, taxItems.id],
    }).onDelete('set null'),
    pgPolicy('job_template_line_items_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobTemplateLineItem = typeof jobTemplateLineItems.$inferSelect
export type NewJobTemplateLineItem = typeof jobTemplateLineItems.$inferInsert

export const estimateTemplateLineItems = pgTable(
  'estimate_template_line_items',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    templateId: text('template_id')
      .notNull()
      .references(() => estimateTemplates.id, { onDelete: 'cascade' }),
    type: lineItemType('type'),
    refId: text('ref_id'),
    title: text('title'),
    description: text('description'),
    qty: numeric('qty'),
    rate: numeric('rate'),
    cost: numeric('cost'),
    taxItemId: text('tax_item_id').references(() => taxItems.id, {
      onDelete: 'set null',
    }),
    groupName: text('group_name'),
    sortOrder: integer('sort_order'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('estimate_template_line_items_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.templateId],
      foreignColumns: [estimateTemplates.tenantId, estimateTemplates.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.taxItemId],
      foreignColumns: [taxItems.tenantId, taxItems.id],
    }).onDelete('set null'),
    pgPolicy('estimate_template_line_items_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type EstimateTemplateLineItem = typeof estimateTemplateLineItems.$inferSelect
export type NewEstimateTemplateLineItem = typeof estimateTemplateLineItems.$inferInsert

export const jobTemplateTasks = pgTable(
  'job_template_tasks',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    templateId: text('template_id')
      .notNull()
      .references(() => jobTemplates.id, { onDelete: 'cascade' }),
    label: text('label'),
    sortOrder: integer('sort_order'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('job_template_tasks_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.templateId],
      foreignColumns: [jobTemplates.tenantId, jobTemplates.id],
    }).onDelete('cascade'),
    pgPolicy('job_template_tasks_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobTemplateTask = typeof jobTemplateTasks.$inferSelect
export type NewJobTemplateTask = typeof jobTemplateTasks.$inferInsert

export const estimateTemplateTasks = pgTable(
  'estimate_template_tasks',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    templateId: text('template_id')
      .notNull()
      .references(() => estimateTemplates.id, { onDelete: 'cascade' }),
    label: text('label'),
    sortOrder: integer('sort_order'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('estimate_template_tasks_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.templateId],
      foreignColumns: [estimateTemplates.tenantId, estimateTemplates.id],
    }).onDelete('cascade'),
    pgPolicy('estimate_template_tasks_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type EstimateTemplateTask = typeof estimateTemplateTasks.$inferSelect
export type NewEstimateTemplateTask = typeof estimateTemplateTasks.$inferInsert

export const jobPhotos = pgTable(
  'job_photos',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    label: text('label'),
    uploadedBy: text('uploaded_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('job_photos_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.jobId],
      foreignColumns: [jobs.tenantId, jobs.id],
    }).onDelete('cascade'),
    pgPolicy('job_photos_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobPhoto = typeof jobPhotos.$inferSelect
export type NewJobPhoto = typeof jobPhotos.$inferInsert

// ── Status Colors (per-tenant dispatch card customization) ───────────────────

export const statusColors = pgTable(
  'status_colors',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    status: jobStatus('status').notNull(),
    bgColor: text('bg_color').notNull().default('#f8fafc'),
    textColor: text('text_color').notNull().default('#1e293b'),
    borderColor: text('border_color').notNull().default('#e2e8f0'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('status_colors_tenant_status_unique').on(t.tenantId, t.status),
    unique('status_colors_tenant_id_unique').on(t.tenantId, t.id),
    pgPolicy('status_colors_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type StatusColor = typeof statusColors.$inferSelect
export type NewStatusColor = typeof statusColors.$inferInsert

// ── Estimate Status Colors (per-tenant estimate card customization) ───────────

export const estimateStatusColors = pgTable(
  'estimate_status_colors',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    status: estimateStatus('status').notNull(),
    bgColor: text('bg_color').notNull().default('#f8fafc'),
    textColor: text('text_color').notNull().default('#1e293b'),
    borderColor: text('border_color').notNull().default('#e2e8f0'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('estimate_status_colors_tenant_status_unique').on(t.tenantId, t.status),
    unique('estimate_status_colors_tenant_id_unique').on(t.tenantId, t.id),
    pgPolicy('estimate_status_colors_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type EstimateStatusColor = typeof estimateStatusColors.$inferSelect
export type NewEstimateStatusColor = typeof estimateStatusColors.$inferInsert

// ── Team Profiles (per-tenant member name/contact overrides) ────────────────

export const teamProfiles = pgTable(
  'team_profiles',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    userId: text('user_id').notNull(), // Clerk user id
    firstName: text('first_name'),
    lastName: text('last_name'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    dateOfBirth: date('date_of_birth'),
    role: text('role'), // cached copy of Clerk role for display
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('team_profiles_tenant_user_unique').on(t.tenantId, t.userId),
    unique('team_profiles_tenant_id_unique').on(t.tenantId, t.id),
    index('team_profiles_user_idx').on(t.userId),
    pgPolicy('team_profiles_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type TeamProfile = typeof teamProfiles.$inferSelect
export type NewTeamProfile = typeof teamProfiles.$inferInsert

// ── Job Signatures (customer signature captured by technician in the field) ──

export const jobSignatures = pgTable(
  'job_signatures',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    signatureType: text('signature_type').$type<'start' | 'complete'>(),
    signedBy: text('signed_by'),
    capturedBy: text('captured_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('job_signatures_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.jobId],
      foreignColumns: [jobs.tenantId, jobs.id],
    }).onDelete('cascade'),
    pgPolicy('job_signatures_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type JobSignature = typeof jobSignatures.$inferSelect
export type NewJobSignature = typeof jobSignatures.$inferInsert

// ── Phase 7: Invoicing and Payments ────────────────────────────────────────

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    isSystem: boolean('is_system').default(false),
    isActive: boolean('is_active').default(true),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('payment_methods_tenant_id_unique').on(t.tenantId, t.id),
    pgPolicy('payment_methods_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type PaymentMethod = typeof paymentMethods.$inferSelect
export type NewPaymentMethod = typeof paymentMethods.$inferInsert

export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    invoiceNo: integer('invoice_no').notNull(),
    status: text('status').notNull().default('active'),
    jobId: text('job_id').notNull(),
    customerId: text('customer_id').notNull(),
    contactId: text('contact_id'),
    serviceLocationId: text('service_location_id'),
    billingLocationId: text('billing_location_id'),
    invoiceDate: date('invoice_date').notNull().default(sql`CURRENT_DATE`),
    dueDate: date('due_date'),
    paymentTermsDays: integer('payment_terms_days').default(30),
    notes: text('notes'),
    internalNotes: text('internal_notes'),
    paymentLinkUrl: text('payment_link_url'),
    sentBy: text('sent_by'),
    sentOn: timestamp('sent_on'),
    emailOpenedAt: timestamp('email_opened_at'),
    total: numeric('total').notNull(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('invoices_tenant_invoice_no_unique').on(t.tenantId, t.invoiceNo),
    unique('invoices_tenant_id_unique').on(t.tenantId, t.id),
    index('invoices_job_id_idx').on(t.jobId),
    index('invoices_customer_id_idx').on(t.customerId),
    foreignKey({
      columns: [t.tenantId, t.jobId],
      foreignColumns: [jobs.tenantId, jobs.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contacts.tenantId, contacts.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.serviceLocationId],
      foreignColumns: [serviceLocations.tenantId, serviceLocations.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.billingLocationId],
      foreignColumns: [serviceLocations.tenantId, serviceLocations.id],
    }).onDelete('set null'),
    pgPolicy('invoices_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert

export const invoiceLineItems = pgTable(
  'invoice_line_items',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    invoiceId: text('invoice_id').notNull(),
    type: lineItemType('type'),
    refId: text('ref_id'),
    title: text('title'),
    description: text('description'),
    qty: numeric('qty'),
    rate: numeric('rate'),
    cost: numeric('cost'),
    taxItemId: text('tax_item_id').references(() => taxItems.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order'),
    groupId: text('group_id'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('invoice_line_items_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.invoiceId],
      foreignColumns: [invoices.tenantId, invoices.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.taxItemId],
      foreignColumns: [taxItems.tenantId, taxItems.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.groupId],
      foreignColumns: [lineItemGroups.tenantId, lineItemGroups.id],
    }).onDelete('set null'),
    pgPolicy('invoice_line_items_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert

export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    paymentNo: integer('payment_no').notNull(),
    jobId: text('job_id'),
    customerId: text('customer_id').notNull(),
    method: text('method').notNull(),
    checkRefNo: text('check_ref_no'),
    receivedBy: text('received_by'),
    receivedOn: date('received_on'),
    memo: text('memo'),
    amount: numeric('amount').notNull(),
    stripeEventId: text('stripe_event_id'),
    last4: text('last4'),
    expiry: text('expiry'),
    transactionToken: text('transaction_token'),
    authCode: text('auth_code'),
    billingAddress: text('billing_address'),
    squarePaymentId: text('square_payment_id'),
    status: text('status').notNull().default('active'),
    enteredAt: timestamp('entered_at').defaultNow(),
    enteredByUserId: text('entered_by_user_id'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('payments_tenant_payment_no_unique').on(t.tenantId, t.paymentNo),
    unique('payments_tenant_id_unique').on(t.tenantId, t.id),
    unique('payments_stripe_event_id_unique').on(t.stripeEventId),
    index('payments_job_id_idx').on(t.jobId),
    index('payments_customer_id_idx').on(t.customerId),
    foreignKey({
      columns: [t.tenantId, t.jobId],
      foreignColumns: [jobs.tenantId, jobs.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }).onDelete('cascade'),
    pgPolicy('payments_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert

export const paymentAllocations = pgTable(
  'payment_allocations',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    paymentId: text('payment_id').notNull(),
    invoiceId: text('invoice_id').notNull(),
    amountApplied: numeric('amount_applied').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    unique('payment_allocations_tenant_payment_invoice_unique').on(
      t.tenantId,
      t.paymentId,
      t.invoiceId,
    ),
    unique('payment_allocations_tenant_id_unique').on(t.tenantId, t.id),
    index('payment_allocations_payment_id_idx').on(t.paymentId),
    index('payment_allocations_invoice_id_idx').on(t.invoiceId),
    foreignKey({
      columns: [t.tenantId, t.paymentId],
      foreignColumns: [payments.tenantId, payments.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.invoiceId],
      foreignColumns: [invoices.tenantId, invoices.id],
    }).onDelete('cascade'),
    pgPolicy('payment_allocations_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type PaymentAllocation = typeof paymentAllocations.$inferSelect
export type NewPaymentAllocation = typeof paymentAllocations.$inferInsert

// ── Phase 8: Communications and Notifications ───────────────────────────────

export const triggerType = pgEnum('trigger_type', [
  'job_confirmation',
  'tech_notify',
  'estimate_send',
  'invoice_send',
  'payment_receipt',
  'on_the_way',
  'appointment_reminder',
])

export const communicationTriggers = pgTable(
  'communication_triggers',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    triggerType: triggerType('trigger_type').notNull(),
    channel: text('channel').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    subject: text('subject'),
    footerText: text('footer_text'),
  },
  (t) => [
    unique('comm_triggers_unique').on(t.tenantId, t.triggerType, t.channel),
    pgPolicy('communication_triggers_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type CommunicationTrigger = typeof communicationTriggers.$inferSelect
export type NewCommunicationTrigger = typeof communicationTriggers.$inferInsert

export const communicationLogs = pgTable(
  'communication_logs',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    customerId: text('customer_id'),
    refKind: text('ref_kind'),
    refId: text('ref_id'),
    triggerType: triggerType('trigger_type'),
    channel: text('channel').notNull(),
    toAddress: text('to_address'),
    status: text('status').notNull(),
    providerMessageId: text('provider_message_id'),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at').defaultNow(),
    deliveredAt: timestamp('delivered_at'),
    openedAt: timestamp('opened_at'),
  },
  (t) => [
    index('comm_logs_provider_msg_idx').on(t.providerMessageId),
    index('comm_logs_ref_idx').on(t.refKind, t.refId),
    pgPolicy('communication_logs_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type CommunicationLog = typeof communicationLogs.$inferSelect
export type NewCommunicationLog = typeof communicationLogs.$inferInsert

export const communicationSettings = pgTable(
  'communication_settings',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    emailSenderName: text('email_sender_name'),
    smsPhoneNumber: text('sms_phone_number'),
  },
  (t) => [
    unique('comm_settings_tenant_unique').on(t.tenantId),
    pgPolicy('communication_settings_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type CommunicationSetting = typeof communicationSettings.$inferSelect
export type NewCommunicationSetting = typeof communicationSettings.$inferInsert

export const scheduledSms = pgTable(
  'scheduled_sms',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: text('tenant_id').notNull(),
    jobId: text('job_id').notNull(),
    contactId: text('contact_id'),
    phone: text('phone').notNull(),
    messageBody: text('message_body').notNull(),
    fireAt: timestamp('fire_at').notNull(),
    sentAt: timestamp('sent_at'),
    cancelledAt: timestamp('cancelled_at'),
    errorMessage: text('error_message'),
  },
  (t) => [
    index('scheduled_sms_due_idx').on(t.fireAt),
    index('scheduled_sms_job_idx').on(t.jobId),
    pgPolicy('scheduled_sms_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type ScheduledSms = typeof scheduledSms.$inferSelect
export type NewScheduledSms = typeof scheduledSms.$inferInsert

// ── Communication Templates ─────────────────────────────────────────────────
// Reusable message templates selectable when sending emails/SMS.
// category: 'invoice' | 'estimate' | 'job' | 'general'
// channel:  'email' | 'sms'
export const communicationTemplates = pgTable(
  'communication_templates',
  {
    id:        text('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId:  text('tenant_id').notNull(),
    name:      text('name').notNull(),
    category:  text('category').notNull(),
    channel:   text('channel').notNull().default('email'),
    subject:   text('subject'),
    body:      text('body'),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    index('comm_templates_tenant_idx').on(t.tenantId),
    pgPolicy('communication_templates_tenant_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type CommunicationTemplate = typeof communicationTemplates.$inferSelect
export type NewCommunicationTemplate = typeof communicationTemplates.$inferInsert
