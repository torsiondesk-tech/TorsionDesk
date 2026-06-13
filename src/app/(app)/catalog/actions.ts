'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { withTenant } from '@/db/with-tenant'
import { products, services, productCategories } from '@/db/schema'
import {
  createProduct as createProductLib,
  updateProduct as updateProductLib,
  deleteProduct as deleteProductLib,
  createService as createServiceLib,
  updateService as updateServiceLib,
  deleteService as deleteServiceLib,
  createCatalogItem,
  listAllForExport,
} from '@/lib/catalog'

// ── Helpers ────────────────────────────────────────────────────────────────

// Base UI Checkbox does not render a native <input>, so we use hidden inputs
// that submit '1' (checked) or '0' (unchecked). This helper maps those back to
// booleans and falls back to the default when the field is missing.
const formBool = (defaultValue: boolean) =>
  z.preprocess(
    (val) => {
      if (val === '1' || val === true) return true
      if (val === '0' || val === false) return false
      return undefined
    },
    z.boolean().default(defaultValue),
  )

// ── Schemas ────────────────────────────────────────────────────────────────

const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(255),
  categoryId: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  sku: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  upc: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  model: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  partNo: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  type: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  unitPrice: z.string().min(1, 'Unit price is required.'),
  unitCost: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  active: formBool(true),
  inventoryItem: formBool(false),
  salesDescription: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  purchaseDescription: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  vendor1Name: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  vendor1Price: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  vendor2Name: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  vendor2Price: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  vendor3Name: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  vendor3Price: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
})

const updateProductSchema = createProductSchema.extend({
  id: z.string().min(1),
})

const createServiceSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(255),
  categoryId: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  unitPrice: z.string().min(1, 'Unit price is required.'),
  unitCost: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  description: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.string().optional(),
  ),
  active: formBool(true),
})

const updateServiceSchema = createServiceSchema.extend({
  id: z.string().min(1),
})

// ── Action State Types ─────────────────────────────────────────────────────

export type ProductActionState = {
  error?: string
  success?: boolean
  id?: string
}

export type ServiceActionState = {
  error?: string
  success?: boolean
  id?: string
}

// ── Actions ────────────────────────────────────────────────────────────────

export async function createProduct(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = createProductSchema.safeParse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    sku: formData.get('sku'),
    upc: formData.get('upc'),
    model: formData.get('model'),
    partNo: formData.get('partNo'),
    type: formData.get('type'),
    unitPrice: formData.get('unitPrice'),
    unitCost: formData.get('unitCost'),
    active: formData.get('active'),
    inventoryItem: formData.get('inventoryItem'),
    salesDescription: formData.get('salesDescription'),
    purchaseDescription: formData.get('purchaseDescription'),
    vendor1Name: formData.get('vendor1Name'),
    vendor1Price: formData.get('vendor1Price'),
    vendor2Name: formData.get('vendor2Name'),
    vendor2Price: formData.get('vendor2Price'),
    vendor3Name: formData.get('vendor3Name'),
    vendor3Price: formData.get('vendor3Price'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const data = parsed.data

  try {
    const id = await withTenant(orgId, async (tx) => {
      // Cross-tenant category guard (T-02-07)
      if (data.categoryId) {
        const cat = await tx
          .select({ id: productCategories.id })
          .from(productCategories)
          .where(
            and(
              eq(productCategories.tenantId, orgId),
              eq(productCategories.id, data.categoryId),
            ),
          )
          .limit(1)
        if (cat.length === 0) {
          throw new Error('Invalid category: cross-tenant access denied')
        }
      }

      const result = await createProductLib(orgId, data)
      return result.id
    })

    revalidatePath('/catalog')
    return { success: true, id }
  } catch (err) {
    console.error('createProduct error:', err)
    return { error: 'Could not save product. Please try again.' }
  }
}

export async function updateProduct(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = updateProductSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    sku: formData.get('sku'),
    upc: formData.get('upc'),
    model: formData.get('model'),
    partNo: formData.get('partNo'),
    type: formData.get('type'),
    unitPrice: formData.get('unitPrice'),
    unitCost: formData.get('unitCost'),
    active: formData.get('active'),
    inventoryItem: formData.get('inventoryItem'),
    salesDescription: formData.get('salesDescription'),
    purchaseDescription: formData.get('purchaseDescription'),
    vendor1Name: formData.get('vendor1Name'),
    vendor1Price: formData.get('vendor1Price'),
    vendor2Name: formData.get('vendor2Name'),
    vendor2Price: formData.get('vendor2Price'),
    vendor3Name: formData.get('vendor3Name'),
    vendor3Price: formData.get('vendor3Price'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const { id, ...data } = parsed.data

  try {
    await withTenant(orgId, async (tx) => {
      // Cross-tenant category guard (T-02-07)
      if (data.categoryId) {
        const cat = await tx
          .select({ id: productCategories.id })
          .from(productCategories)
          .where(
            and(
              eq(productCategories.tenantId, orgId),
              eq(productCategories.id, data.categoryId),
            ),
          )
          .limit(1)
        if (cat.length === 0) {
          throw new Error('Invalid category: cross-tenant access denied')
        }
      }

      await updateProductLib(orgId, id, data)
    })

    revalidatePath('/catalog')
    return { success: true, id }
  } catch (err) {
    console.error('updateProduct error:', err)
    return { error: 'Could not save product. Please try again.' }
  }
}

export async function deleteProduct(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const id = String(formData.get('id') ?? '')
  if (!id) {
    return { error: 'Product ID is required.' }
  }

  try {
    await deleteProductLib(orgId, id)
    revalidatePath('/catalog')
    return { success: true }
  } catch (err) {
    console.error('deleteProduct error:', err)
    return { error: 'Could not delete product. Please try again.' }
  }
}

export async function createService(
  _prevState: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = createServiceSchema.safeParse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    unitPrice: formData.get('unitPrice'),
    unitCost: formData.get('unitCost'),
    description: formData.get('description'),
    active: formData.get('active'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const data = parsed.data

  try {
    const id = await withTenant(orgId, async (tx) => {
      // Cross-tenant category guard (T-02-07)
      if (data.categoryId) {
        const cat = await tx
          .select({ id: productCategories.id })
          .from(productCategories)
          .where(
            and(
              eq(productCategories.tenantId, orgId),
              eq(productCategories.id, data.categoryId),
            ),
          )
          .limit(1)
        if (cat.length === 0) {
          throw new Error('Invalid category: cross-tenant access denied')
        }
      }

      const result = await createServiceLib(orgId, data)
      return result.id
    })

    revalidatePath('/catalog')
    return { success: true, id }
  } catch (err) {
    console.error('createService error:', err)
    return { error: 'Could not save service. Please try again.' }
  }
}

export async function updateService(
  _prevState: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = updateServiceSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    unitPrice: formData.get('unitPrice'),
    unitCost: formData.get('unitCost'),
    description: formData.get('description'),
    active: formData.get('active'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const { id, ...data } = parsed.data

  try {
    await withTenant(orgId, async (tx) => {
      // Cross-tenant category guard (T-02-07)
      if (data.categoryId) {
        const cat = await tx
          .select({ id: productCategories.id })
          .from(productCategories)
          .where(
            and(
              eq(productCategories.tenantId, orgId),
              eq(productCategories.id, data.categoryId),
            ),
          )
          .limit(1)
        if (cat.length === 0) {
          throw new Error('Invalid category: cross-tenant access denied')
        }
      }

      await updateServiceLib(orgId, id, data)
    })

    revalidatePath('/catalog')
    return { success: true, id }
  } catch (err) {
    console.error('updateService error:', err)
    return { error: 'Could not save service. Please try again.' }
  }
}

export async function deleteService(
  _prevState: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const id = String(formData.get('id') ?? '')
  if (!id) {
    return { error: 'Service ID is required.' }
  }

  try {
    await deleteServiceLib(orgId, id)
    revalidatePath('/catalog')
    return { success: true }
  } catch (err) {
    console.error('deleteService error:', err)
    return { error: 'Could not delete service. Please try again.' }
  }
}

// ── RPC-style actions ──────────────────────────────────────────────────────

export async function createCatalogItemAction(
  input: {
    kind: 'product' | 'service'
    name: string
    categoryId: string
    unitPrice: string
    unitCost?: string
    description?: string
  },
): Promise<{ id: string; name: string; unitPrice: string }> {
  const { orgId } = await auth()
  if (!orgId) throw new Error('No active organization')
  return createCatalogItem(orgId, input)
}

// ── CSV Export ─────────────────────────────────────────────────────────────

export async function exportCatalogCsv(kind: 'product' | 'service'): Promise<string> {
  const { orgId } = await auth()
  if (!orgId) throw new Error('No active organization')

  const rows = await listAllForExport(orgId, kind)

  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    // Neutralize CSV formula injection (T-02-08): prefix = + - @ with '
    const neutralized = /^[=+\-@]/.test(s) ? "'" + s : s
    // RFC-4180 escape
    return /[",\n]/.test(neutralized)
      ? `"${neutralized.replace(/"/g, '""')}"`
      : neutralized
  }

  if (kind === 'product') {
    const headers = ['Name', 'Category', 'Price', 'Cost', 'SKU', 'Active']
    const lines = [headers.join(',')]
    for (const r of rows) {
      lines.push(
        [
          r.name,
          r.categoryName,
          r.unitPrice,
          r.unitCost,
          r.sku,
          r.active ? 'Yes' : 'No',
        ]
          .map(esc)
          .join(','),
      )
    }
    return lines.join('\r\n')
  }

  const headers = ['Name', 'Category', 'Price', 'Cost', 'Active']
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(
      [r.name, r.categoryName, r.unitPrice, r.unitCost, r.active ? 'Yes' : 'No']
        .map(esc)
        .join(','),
    )
  }
  return lines.join('\r\n')
}
