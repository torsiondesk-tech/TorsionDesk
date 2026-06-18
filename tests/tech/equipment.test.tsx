import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createTechDb, type CachedEquipment } from '@/app/(tech)/lib/dexie'
import { EquipmentSection } from '@/app/(tech)/components/equipment-section'

const orgId = 'org_eq'
const serviceLocationId = 'loc_eq_1'

describe('EquipmentSection', () => {
  let db: ReturnType<typeof createTechDb>

  beforeEach(async () => {
    db = createTechDb(orgId)
    await db.open()

    const equipment: CachedEquipment[] = [
      {
        id: 'eq-door-1',
        tenantId: orgId,
        serviceLocationId,
        kind: 'door',
        brand: 'Clopay',
        installDate: null,
        warrantyExpires: null,
        notes: null,
        widthFt: '16',
        heightFt: '7',
        material: 'Steel',
        style: 'Raised panel',
        color: 'White',
        modelSeries: 'Classic',
        model: null,
        hp: null,
        serial: null,
        wireSize: null,
        insideDiameter: null,
        length: null,
        windDirection: null,
        cycleRating: null,
      },
      {
        id: 'eq-spring-1',
        tenantId: orgId,
        serviceLocationId,
        kind: 'spring',
        brand: null,
        installDate: null,
        warrantyExpires: null,
        notes: null,
        widthFt: null,
        heightFt: null,
        material: null,
        style: null,
        color: null,
        modelSeries: null,
        model: null,
        hp: null,
        serial: null,
        wireSize: '0.250',
        insideDiameter: '2.00',
        length: '32.00',
        windDirection: 'left',
        cycleRating: 10000,
      },
    ]

    await db.equipment.bulkPut(equipment)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('renders door and spring specs from cached equipment', async () => {
    render(
      <EquipmentSection
        orgId={orgId}
        serviceLocationId={serviceLocationId}
        serverEquipment={[]}
      />,
    )

    expect(await screen.findByText('Clopay')).toBeInTheDocument()
    expect(await screen.findByText('0.250')).toBeInTheDocument()
    expect(await screen.findByText('Spring specs')).toBeInTheDocument()
  })
})
