'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox'
import { searchCustomersAction } from '@/app/(app)/customers/actions'

export interface CustomerSearchResult {
  id: string
  name: string
  primaryAddress: string
}

interface CustomerSearchProps {
  name?: string
  defaultValue?: string
  defaultLabel?: string
  onChange?: (value: string | null) => void
}

export function CustomerSearch({
  name = 'parentCustomerId',
  defaultValue,
  defaultLabel,
  onChange,
}: CustomerSearchProps) {
  const [value, setValue] = useState<string | null>(defaultValue ?? null)
  const [label, setLabel] = useState(defaultLabel ?? '')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const rows = await searchCustomersAction(q)
        setResults(rows)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.currentTarget.value
      setQuery(v)
      if (value) {
        setValue(null)
        onChange?.(null)
      }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        search(v)
      }, 250)
    },
    [value, onChange, search]
  )

  const handleSelect = useCallback(
    (val: string | null) => {
      const row = results.find((r) => r.id === val)
      if (!row) return
      setValue(row.id)
      setLabel(row.name)
      setQuery('')
      setResults([])
      onChange?.(row.id)
    },
    [results, onChange]
  )

  return (
    <div className="flex flex-col gap-1.5">
      <Combobox value={value ?? undefined} onValueChange={handleSelect}>
        <ComboboxInput
          placeholder="Search by name, phone, email, or address…"
          value={value ? label : query}
          onChange={handleInputChange}
          showClear={!!value}
        />
        <ComboboxContent>
          <ComboboxList>
            {loading && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
            )}
            {!loading &&
              results.map((r) => (
                <ComboboxItem key={r.id} value={r.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{r.name}</span>
                    {r.primaryAddress && (
                      <span className="text-xs text-muted-foreground">
                        {r.primaryAddress}
                      </span>
                    )}
                  </div>
                </ComboboxItem>
              ))}
            {!loading && !results.length && query.trim() && (
              <ComboboxEmpty>No customers found</ComboboxEmpty>
            )}
            {!loading && !results.length && !query.trim() && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Start typing to search…
              </div>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <input type="hidden" name={name} value={value ?? ''} />
    </div>
  )
}
