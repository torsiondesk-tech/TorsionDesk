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
    name: text('name').notNull(),
    smsConsent: boolean('sms_consent').default(false),
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
    type: phoneType('type').notNull().default('cell'),
    isPrimary: boolean('is_primary').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
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
    name: text('name').notNull(),
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
