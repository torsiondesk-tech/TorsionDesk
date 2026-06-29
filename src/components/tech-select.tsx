'use client'

import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox'

interface TechSelectProps {
  name?: string
  members: Array<{ id: string; label: string }>
  defaultSelected?: string[]
  onChange?: (selected: string[]) => void
}

export function TechSelect({
  name = 'assigneeUserIds',
  members,
  defaultSelected = [],
  onChange,
}: TechSelectProps) {
  const [selected, setSelected] = useState<string[]>(defaultSelected)
  const [query, setQuery] = useState('')

  const add = useCallback((id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      onChange?.(next)
      return next
    })
    setQuery('')
  }, [onChange])

  const remove = useCallback((id: string) => {
    setSelected((prev) => {
      const next = prev.filter((s) => s !== id)
      onChange?.(next)
      return next
    })
  }, [onChange])

  const filtered = members.filter(
    (m) =>
      !selected.includes(m.id) &&
      (!query || m.label.toLowerCase().includes(query.toLowerCase())),
  )

  const selectedMembers = selected
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as Array<{ id: string; label: string }>

  return (
    <div className="flex flex-col gap-1.5">
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedMembers.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
            >
              {m.label}
              <button
                type="button"
                onClick={() => remove(m.id)}
                className="inline-flex opacity-60 hover:opacity-100"
                aria-label={`Remove ${m.label}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Combobox>
        <ComboboxInput
          aria-label="Search technicians"
          placeholder="Search techs…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          showTrigger={false}
        />
        <ComboboxContent>
          <ComboboxList>
            {filtered.map((m) => (
              <ComboboxItem key={m.id} value={m.id} onClick={() => add(m.id)}>
                {m.label}
              </ComboboxItem>
            ))}
            {!filtered.length && <ComboboxEmpty>No techs found</ComboboxEmpty>}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </div>
  )
}
