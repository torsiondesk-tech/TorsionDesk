/**
 * CUST-04 — per-kind equipment Zod union validation (RED until src/lib/equipment-schema.ts exists).
 *
 * Contract: equipmentSchema (Zod union, discriminator: `kind`) accepts/rejects
 * door, opener, and spring shapes correctly.
 */

import { describe, it, expect } from 'vitest'

// Not-yet-existing module under test — RED signal.
import { equipmentSchema } from '@/lib/equipment-schema'

describe('equipmentSchema', () => {
  describe('door', () => {
    it('accepts a valid door', () => {
      const result = equipmentSchema.safeParse({
        kind: 'door',
        brand: 'Clopay',
        widthFt: 8,
        heightFt: 7,
        material: 'steel',
        style: 'carriage',
        color: 'white',
        modelSeries: 'Gallery',
      })
      expect(result.success).toBe(true)
    })

    it('rejects a door missing brand', () => {
      const result = equipmentSchema.safeParse({
        kind: 'door',
        widthFt: 8,
        heightFt: 7,
      })
      expect(result.success).toBe(false)
    })

    it('rejects a door with non-positive width', () => {
      const result = equipmentSchema.safeParse({
        kind: 'door',
        brand: 'Clopay',
        widthFt: 0,
        heightFt: 7,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('opener', () => {
    it('accepts a valid opener', () => {
      const result = equipmentSchema.safeParse({
        kind: 'opener',
        brand: 'LiftMaster',
        model: '8550W',
        hp: 0.75,
        serial: 'ABC123',
      })
      expect(result.success).toBe(true)
    })

    it('rejects an opener missing brand', () => {
      const result = equipmentSchema.safeParse({
        kind: 'opener',
        model: '8550W',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('spring', () => {
    it('accepts a valid spring', () => {
      const result = equipmentSchema.safeParse({
        kind: 'spring',
        wireSize: 0.25,
        insideDiameter: 1.75,
        length: 32,
        windDirection: 'pair',
        cycleRating: 10000,
      })
      expect(result.success).toBe(true)
    })

    it('rejects a spring with invalid windDirection', () => {
      const result = equipmentSchema.safeParse({
        kind: 'spring',
        wireSize: 0.25,
        insideDiameter: 1.75,
        length: 32,
        windDirection: 'sideways',
      })
      expect(result.success).toBe(false)
    })

    it('rejects a spring missing wireSize', () => {
      const result = equipmentSchema.safeParse({
        kind: 'spring',
        insideDiameter: 1.75,
        length: 32,
        windDirection: 'left',
      })
      expect(result.success).toBe(false)
    })
  })
})
