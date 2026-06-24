/**
 * Job line-item SearchDropdown custom-add interaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { SearchDropdown } from '@/app/(app)/jobs/[id]/line-items'

vi.mock('@/app/(app)/jobs/actions', () => ({
  searchProductsAction: vi.fn(() => Promise.resolve([])),
  searchServicesAction: vi.fn(() => Promise.resolve([])),
}))

function StatefulSearchDropdown(
  props: Pick<React.ComponentPropsWithoutRef<typeof SearchDropdown>, 'onSelect' | 'onCreateNew' | 'onAddCustom'>,
) {
  const [query, setQuery] = useState('')

  return (
    <SearchDropdown
      {...props}
      kind="product"
      query={query}
      results={[]}
      loading={false}
      onQueryChange={setQuery}
    />
  )
}

describe('SearchDropdown custom add', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fires onAddCustom when the custom product button is clicked', async () => {
    const onAddCustom = vi.fn()
    const onCreateNew = vi.fn()
    const onSelect = vi.fn()

    render(
      <StatefulSearchDropdown
        onSelect={onSelect}
        onCreateNew={onCreateNew}
        onAddCustom={onAddCustom}
      />,
    )

    const input = screen.getByPlaceholderText('Search products...')
    await user.type(input, 'Custom Widget')

    const buttons = await screen.findAllByRole('button')
    const customButton = buttons.find((b) => b.textContent?.includes('Custom Widget'))
    expect(customButton).toBeDefined()
    await user.click(customButton!)

    await waitFor(() => expect(onAddCustom).toHaveBeenCalledWith('Custom Widget'), { timeout: 2000 })
    expect(onCreateNew).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
