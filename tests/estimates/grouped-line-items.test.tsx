/**
 * EST-04 — GroupedLineItems collapse/expand UI state
 * (RED until src/components/line-items/grouped-line-items.tsx exists).
 *
 * Contract:
 *   1. Clicking a group header CollapsibleTrigger toggles the collapsed state.
 *   2. Uses @testing-library/react in the jsdom environment.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Not-yet-existing component under test — RED signal.
import { GroupedLineItems } from '@/components/line-items/grouped-line-items'

describe('GroupedLineItems', () => {
  it('toggles collapsed state when the group header is clicked', () => {
    render(
      <GroupedLineItems
        groups={[{ id: 'g1', name: 'Hardware' }]}
        lineItems={[
          {
            id: 'li_1',
            type: 'product',
            description: 'Torsion spring',
            qty: '2',
            rate: '149.99',
            cost: '75.00',
            groupId: 'g1',
          },
        ]}
        onChange={() => {}}
      />,
    )

    // The group header should be present.
    const header = screen.getByText('Hardware')
    expect(header).toBeDefined()

    // The line item should be visible before collapse.
    expect(screen.queryByText('Torsion spring')).toBeDefined()

    // Click the header to collapse.
    fireEvent.click(header)
    expect(screen.queryByText('Torsion spring')).toBeNull()

    // Click the header again to expand.
    fireEvent.click(header)
    expect(screen.queryByText('Torsion spring')).toBeDefined()
  })
})
