'use client'

import { useState, useCallback, useRef } from 'react'
import { PlusIcon } from 'lucide-react'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxSeparator,
  ComboboxEmpty,
} from '@/components/ui/combobox'
import { searchCustomersAction } from '@/app/(app)/customers/actions'
import { capitalizeWords } from '@/lib/utils'

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
  allowCreate?: boolean
  onCreateNew?: (name: string) => void
  /** Called instead of clearing the selection when the user types while a customer is selected. */
  onReplaceIntent?: (typedChar: string) => void
}

export function CustomerSearch({
  name = 'parentCustomerId',
  defaultValue,
  defaultLabel,
  onChange,
  allowCreate,
  onCreateNew,
  onReplaceIntent,
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

      // When there's a selected customer and the parent wants to intercept, fire
      // the callback and leave internal state untouched — the input will revert
      // to the label on the next render and the parent shows a dialog instead.
      if (value && onReplaceIntent) {
        onReplaceIntent(v)
        return
      }

      setQuery(capitalizeWords(v))
      if (value) {
        setValue(null)
        onChange?.(null)
      }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        search(v)
      }, 250)
    },
    [value, onChange, search, onReplaceIntent]
  )

  const handleSelect = useCallback(
    (val: string | null) => {
      if (val === '__create__') {
        onCreateNew?.(capitalizeWords(query.trim()))
        setQuery('')
        setResults([])
        return
      }
      if (!val) {
        setValue(null)
        setLabel('')
        setQuery('')
        setResults([])
        onChange?.(null)
        return
      }
      const row = results.find((r) => r.id === val)
      if (!row) return
      setValue(row.id)
      setLabel(row.name)
      setQuery('')
      setResults([])
      onChange?.(row.id)
    },
    [results, onChange, query, onCreateNew]
  )

  return (
    <div className="flex flex-col gap-1.5">
      <Combobox value={value ?? ''} onValueChange={handleSelect}>
        <ComboboxInput
          aria-label="Search customers"
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
            {!loading && !results.length && query.trim() && !allowCreate && (
              <ComboboxEmpty>No customers found</ComboboxEmpty>
            )}
            {!loading && !results.length && !query.trim() && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Start typing to search…
              </div>
            )}
            {allowCreate && query.trim() && (
              <>
                {results.length > 0 && <ComboboxSeparator />}
                <ComboboxItem value="__create__" className="text-primary">
                  <PlusIcon className="size-4 shrink-0" />
                  Create new customer &ldquo;{query}&rdquo;
                </ComboboxItem>
              </>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <input type="hidden" name={name} value={value ?? ''} />
    </div>
  )
}
