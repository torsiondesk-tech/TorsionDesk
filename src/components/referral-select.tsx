'use client'

import { useState, useCallback, useId } from 'react'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox'
import { createReferralSourceAction } from '@/app/(app)/customers/actions'

export interface ReferralOption {
  id: string
  name: string
}

interface ReferralSelectProps {
  name?: string
  options: ReferralOption[]
  defaultValue?: string
  onChange?: (value: string | null) => void
}

export function ReferralSelect({
  name = 'referralSourceId',
  options,
  defaultValue,
  onChange,
}: ReferralSelectProps) {
  const [value, setValue] = useState<string | null>(defaultValue ?? null)
  const [all, setAll] = useState<ReferralOption[]>(options)
  const [query, setQuery] = useState('')

  const selected = all.find((r) => r.id === value)

  const handleSelect = useCallback(
    (val: string | null) => {
      if (val?.startsWith('__create__')) {
        const raw = val.slice('__create__'.length)
        handleCreate(raw)
        return
      }
      setValue(val)
      onChange?.(val)
    },
    [onChange]
  )

  const handleCreate = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim()
      if (!trimmed) return
      const exists = all.find(
        (r) => r.name.toLowerCase() === trimmed.toLowerCase()
      )
      if (exists) {
        setValue(exists.id)
        onChange?.(exists.id)
        setQuery('')
        return
      }
      try {
        const created = await createReferralSourceAction(trimmed)
        setAll((prev) => [...prev, created])
        setValue(created.id)
        onChange?.(created.id)
        setQuery('')
      } catch {
        // ignore
      }
    },
    [all, onChange]
  )

  const filtered = query
    ? all.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    : all

  const showCreate =
    query.trim() &&
    !all.some((r) => r.name.toLowerCase() === query.trim().toLowerCase())

  return (
    <div className="flex flex-col gap-1.5">
      <Combobox value={value ?? undefined} onValueChange={handleSelect}>
        <ComboboxInput
          placeholder="Select or create referral source…"
          value={selected?.name ?? query}
          onChange={(e) => {
            setQuery(e.currentTarget.value)
            if (value) {
              setValue(null)
              onChange?.(null)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              e.preventDefault()
              handleCreate(query)
            }
          }}
          showClear={!!value}
        />
        <ComboboxContent>
          <ComboboxList>
            {filtered.map((r) => (
              <ComboboxItem key={r.id} value={r.id}>
                {r.name}
              </ComboboxItem>
            ))}
            {showCreate && (
              <ComboboxItem
                value={`__create__${query}`}
                onClick={() => handleCreate(query)}
                className="font-medium text-primary"
              >
                Create “{query.trim()}”
              </ComboboxItem>
            )}
            {!filtered.length && !showCreate && (
              <ComboboxEmpty>No referral sources found</ComboboxEmpty>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <input type="hidden" name={name} value={value ?? ''} />
    </div>
  )
}
