import { eq, and, desc, asc, sql, count, gte, lte } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import { products, services, productCategories } from '@/db/schema'

export interface ProductListOpts {
  page?: number
  pageSize?: number
  categoryId?: string
  active?: boolean
  inventoryItem?: boolean
  q?: string
  minPrice?: string
  maxPrice?: string
  sort?: string
}

export interface ServiceListOpts {
  page?: number
  pageSize?: number
  categoryId?: string
  active?: boolean
  q?: string
  sort?: string
}

export interface ProductRow {
  id: string
  name: string
  categoryName: string | null
  unitPrice: string | null
  unitCost: string | null
  salesDescription: string | null
  sku: string | null
  active: boolean | null
}

export interface ServiceRow {
  id: string
  name: string
  categoryName: string | null
  unitPrice: string | null
  unitCost: string | null
  description: string | null
  active: boolean | null
}

export async function getProductById(
  orgId: string,
  id: string,
): Promise<typeof products.$inferSelect | null> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(products)
      .where(and(eq(products.tenantId, orgId), eq(products.id, id)))
      .limit(1)
    return rows[0] ?? null
  })
}

export async function getServiceById(
  orgId: string,
  id: string,
): Promise<typeof services.$inferSelect | null> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(services)
      .where(and(eq(services.tenantId, orgId), eq(services.id, id)))
      .limit(1)
    return rows[0] ?? null
  })
}

/* ── List queries ─────────────────────────────────────────────────────────── */

export async function listProducts(
  orgId: string,
  opts: ProductListOpts,
): Promise<{ rows: ProductRow[]; pageCount: number }> {
  const page = opts.page ?? 0
  const pageSize = opts.pageSize ?? 25

  return withTenant(orgId, async (tx) => {
    const conditions: Array<ReturnType<typeof eq>> = [eq(products.tenantId, orgId)]

    if (opts.categoryId) {
      conditions.push(eq(products.categoryId, opts.categoryId))
    }
    if (opts.active !== undefined) {
      conditions.push(eq(products.active, opts.active))
    }
    if (opts.inventoryItem !== undefined) {
      conditions.push(eq(products.inventoryItem, opts.inventoryItem))
    }
    if (opts.q) {
      const term = `%${opts.q}%`
      conditions.push(
        sql`${products.name} ILIKE ${term} OR ${products.sku} ILIKE ${term}`,
      )
    }
    if (opts.minPrice) {
      conditions.push(gte(products.unitPrice, opts.minPrice))
    }
    if (opts.maxPrice) {
      conditions.push(lte(products.unitPrice, opts.maxPrice))
    }

    const sortCol = opts.sort === 'price' ? products.unitPrice : products.name
    const order = opts.sort === 'price' ? asc(sortCol) : asc(sortCol)

    const [{ c }] = await tx
      .select({ c: count() })
      .from(products)
      .where(and(...conditions))

    const pageCount = Math.ceil(c / pageSize)

    const rows = await tx
      .select({
        id: products.id,
        name: products.name,
        categoryName: productCategories.name,
        unitPrice: products.unitPrice,
        unitCost: products.unitCost,
        salesDescription: products.salesDescription,
        sku: products.sku,
        active: products.active,
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .where(and(...conditions))
      .orderBy(order)
      .limit(pageSize)
      .offset(page * pageSize)

    return { rows, pageCount }
  })
}

export async function listServices(
  orgId: string,
  opts: ServiceListOpts,
): Promise<{ rows: ServiceRow[]; pageCount: number }> {
  const page = opts.page ?? 0
  const pageSize = opts.pageSize ?? 25

  return withTenant(orgId, async (tx) => {
    const conditions: Array<ReturnType<typeof eq>> = [eq(services.tenantId, orgId)]

    if (opts.categoryId) {
      conditions.push(eq(services.categoryId, opts.categoryId))
    }
    if (opts.active !== undefined) {
      conditions.push(eq(services.active, opts.active))
    }
    if (opts.q) {
      const term = `%${opts.q}%`
      conditions.push(sql`${services.name} ILIKE ${term}`)
    }

    const sortCol = opts.sort === 'price' ? services.unitPrice : services.name
    const order = opts.sort === 'price' ? asc(sortCol) : asc(sortCol)

    const [{ c }] = await tx
      .select({ c: count() })
      .from(services)
      .where(and(...conditions))

    const pageCount = Math.ceil(c / pageSize)

    const rows = await tx
      .select({
        id: services.id,
        name: services.name,
        categoryName: productCategories.name,
        unitPrice: services.unitPrice,
        unitCost: services.unitCost,
        description: services.description,
        active: services.active,
      })
      .from(services)
      .leftJoin(productCategories, eq(services.categoryId, productCategories.id))
      .where(and(...conditions))
      .orderBy(order)
      .limit(pageSize)
      .offset(page * pageSize)

    return { rows, pageCount }
  })
}

export async function listProductCategories(
  orgId: string,
): Promise<Array<{ id: string; name: string }>> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({ id: productCategories.id, name: productCategories.name })
      .from(productCategories)
      .where(eq(productCategories.tenantId, orgId))
      .orderBy(productCategories.name)
  })
}

/* ── Mutations ────────────────────────────────────────────────────────────── */

export async function createProduct(
  orgId: string,
  input: Omit<typeof products.$inferInsert, 'tenantId' | 'id' | 'createdAt' | 'updatedAt'>,
): Promise<{ id: string }> {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .insert(products)
      .values({ tenantId: orgId, ...input })
      .returning({ id: products.id })
    return { id: row.id }
  })
}

export async function updateProduct(
  orgId: string,
  id: string,
  input: Partial<Omit<typeof products.$inferInsert, 'tenantId' | 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<{ id: string }> {
  return withTenant(orgId, async (tx) => {
    await tx
      .update(products)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(products.tenantId, orgId), eq(products.id, id)))
    return { id }
  })
}

export async function deleteProduct(
  orgId: string,
  id: string,
): Promise<{ id: string }> {
  return withTenant(orgId, async (tx) => {
    await tx
      .delete(products)
      .where(and(eq(products.tenantId, orgId), eq(products.id, id)))
    return { id }
  })
}

export async function createService(
  orgId: string,
  input: Omit<typeof services.$inferInsert, 'tenantId' | 'id' | 'createdAt' | 'updatedAt'>,
): Promise<{ id: string }> {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .insert(services)
      .values({ tenantId: orgId, ...input })
      .returning({ id: services.id })
    return { id: row.id }
  })
}

export async function updateService(
  orgId: string,
  id: string,
  input: Partial<Omit<typeof services.$inferInsert, 'tenantId' | 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<{ id: string }> {
  return withTenant(orgId, async (tx) => {
    await tx
      .update(services)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(services.tenantId, orgId), eq(services.id, id)))
    return { id }
  })
}

export async function deleteService(
  orgId: string,
  id: string,
): Promise<{ id: string }> {
  return withTenant(orgId, async (tx) => {
    await tx
      .delete(services)
      .where(and(eq(services.tenantId, orgId), eq(services.id, id)))
    return { id }
  })
}

/* ── RPC helpers ──────────────────────────────────────────────────────────── */

export async function createCatalogItem(
  orgId: string,
  input: {
    kind: 'product' | 'service'
    name: string
    categoryId: string
    unitPrice: string
    unitCost?: string
    description?: string
  },
): Promise<{ id: string; name: string; unitPrice: string; unitCost: string | null; description: string | null }> {
  return withTenant(orgId, async (tx) => {
    // Cross-tenant category guard (T-02-11)
    const cat = await tx
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.tenantId, orgId),
          eq(productCategories.id, input.categoryId),
        ),
      )
      .limit(1)
    if (cat.length === 0) {
      throw new Error('Invalid category: cross-tenant access denied')
    }

    if (input.kind === 'product') {
      const [row] = await tx
        .insert(products)
        .values({
          tenantId: orgId,
          name: input.name,
          categoryId: input.categoryId,
          unitPrice: input.unitPrice,
          unitCost: input.unitCost,
          salesDescription: input.description,
        })
        .returning({
          id: products.id,
          name: products.name,
          unitPrice: products.unitPrice,
          unitCost: products.unitCost,
          salesDescription: products.salesDescription,
        })
      return { id: row.id, name: row.name, unitPrice: row.unitPrice ?? '', unitCost: row.unitCost ?? null, description: row.salesDescription ?? null }
    }

    const [row] = await tx
      .insert(services)
      .values({
        tenantId: orgId,
        name: input.name,
        categoryId: input.categoryId,
        unitPrice: input.unitPrice,
        unitCost: input.unitCost,
        description: input.description,
      })
      .returning({
        id: services.id,
        name: services.name,
        unitPrice: services.unitPrice,
        unitCost: services.unitCost,
        description: services.description,
      })
    return { id: row.id, name: row.name, unitPrice: row.unitPrice ?? '', unitCost: row.unitCost ?? null, description: row.description ?? null }
  })
}

/* ── Export ───────────────────────────────────────────────────────────────── */

export async function listAllForExport(
  orgId: string,
  kind: 'product' | 'service',
): Promise<Array<Record<string, unknown>>> {
  return withTenant(orgId, async (tx) => {
    if (kind === 'product') {
      return tx
        .select({
          name: products.name,
          categoryName: productCategories.name,
          unitPrice: products.unitPrice,
          unitCost: products.unitCost,
          sku: products.sku,
          active: products.active,
        })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(eq(products.tenantId, orgId))
        .orderBy(products.name)
    }

    return tx
      .select({
        name: services.name,
        categoryName: productCategories.name,
        unitPrice: services.unitPrice,
        unitCost: services.unitCost,
        active: services.active,
      })
      .from(services)
      .leftJoin(productCategories, eq(services.categoryId, productCategories.id))
      .where(eq(services.tenantId, orgId))
      .orderBy(services.name)
  })
}
