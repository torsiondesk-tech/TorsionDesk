import { z } from 'zod'

/**
 * Per-kind equipment validation (discriminator: `kind` literal).
 * DB columns stay nullable; enforcement lives in the Zod schema.
 */
export const equipmentSchema = z.union([
  z.object({
    kind: z.literal('door'),
    brand: z.string().trim().min(1, 'Brand is required'),
    widthFt: z.coerce.number().positive('Width must be greater than 0'),
    heightFt: z.coerce.number().positive('Height must be greater than 0'),
    material: z.string().optional(),
    style: z.string().optional(),
    color: z.string().optional(),
    modelSeries: z.string().optional(),
    installDate: z.string().optional(),
    warrantyExpires: z.string().optional(),
    notes: z.string().optional(),
  }),
  z.object({
    kind: z.literal('opener'),
    brand: z.string().trim().min(1, 'Brand is required'),
    model: z.string().optional(),
    hp: z.coerce.number().optional(),
    serial: z.string().optional(),
    installDate: z.string().optional(),
    warrantyExpires: z.string().optional(),
    notes: z.string().optional(),
  }),
  z.object({
    kind: z.literal('spring'),
    wireSize: z.coerce.number().positive('Wire size must be greater than 0'),
    insideDiameter: z.coerce.number().positive('Inside diameter must be greater than 0'),
    length: z.coerce.number().positive('Length must be greater than 0'),
    windDirection: z.enum(['left', 'right', 'pair']),
    cycleRating: z.coerce.number().int().optional(),
    installDate: z.string().optional(),
    warrantyExpires: z.string().optional(),
    notes: z.string().optional(),
  }),
])

export type EquipmentInput = z.infer<typeof equipmentSchema>
