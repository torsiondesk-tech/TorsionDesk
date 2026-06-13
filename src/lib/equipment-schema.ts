import { z } from 'zod'

/**
 * Per-kind equipment validation (discriminator: `kind` literal).
 * DB columns stay nullable; enforcement lives in the Zod schema.
 *
 * Numeric columns use `z.string()` with regex validation so the exact decimal
 * representation is preserved straight through to the DB — never passing
 * through a JS Number (IEEE-754) which would silently truncate high-precision
 * values (AUDIT-013).
 */
const numericString = (msg: string) =>
  z.string().regex(/^(?!0+(?:\.0+)?$)\d+(\.\d+)?$/, msg)

export const equipmentSchema = z.union([
  z.object({
    kind: z.literal('door'),
    brand: z.string().trim().min(1, 'Brand is required').max(255),
    widthFt: numericString('Width must be a positive number'),
    heightFt: numericString('Height must be a positive number'),
    material: z.string().max(100).optional(),
    style: z.string().max(100).optional(),
    color: z.string().max(100).optional(),
    modelSeries: z.string().max(255).optional(),
    installDate: z.string().optional(),
    warrantyExpires: z.string().optional(),
    notes: z.string().max(2000).optional(),
  }),
  z.object({
    kind: z.literal('opener'),
    brand: z.string().trim().min(1, 'Brand is required').max(255),
    model: z.string().max(255).optional(),
    hp: z.string().regex(/^\d+(\.\d+)?$/).optional(),
    serial: z.string().max(255).optional(),
    installDate: z.string().optional(),
    warrantyExpires: z.string().optional(),
    notes: z.string().max(2000).optional(),
  }),
  z.object({
    kind: z.literal('spring'),
    wireSize: numericString('Wire size must be a positive number'),
    insideDiameter: numericString('Inside diameter must be a positive number'),
    length: numericString('Length must be a positive number'),
    windDirection: z.enum(['left', 'right', 'pair']),
    cycleRating: z.coerce.number().int().optional(),
    installDate: z.string().optional(),
    warrantyExpires: z.string().optional(),
    notes: z.string().max(2000).optional(),
  }),
])

export type EquipmentInput = z.infer<typeof equipmentSchema>
