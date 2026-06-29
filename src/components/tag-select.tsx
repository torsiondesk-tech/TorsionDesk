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
import { createTagAction } from '@/app/(app)/customers/actions'

export interface TagOption {
  id: string
  name: string
}

interface TagSelectProps {
  name?: string
  availableTags: TagOption[]
  defaultSelected?: TagOption[]
  onChange?: (selected: TagOption[]) => void
}

export function TagSelect({
  name = 'tagIds',
  availableTags,
  defaultSelected = [],
  onChange,
}: TagSelectProps) {
  const [selected, setSelected] = useState<TagOption[]>(defaultSelected)
  const [options, setOptions] = useState<TagOption[]>(availableTags)
  const [query, setQuery] = useState('')

  const addTag = useCallback(
    (tag: TagOption) => {
      if (selected.find((t) => t.id === tag.id)) return
      const next = [...selected, tag]
      setSelected(next)
      onChange?.(next)
      setQuery('')
    },
    [selected, onChange]
  )

  const removeTag = useCallback(
    (id: string) => {
      const next = selected.filter((t) => t.id !== id)
      setSelected(next)
      onChange?.(next)
    },
    [selected, onChange]
  )

  const handleCreate = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim()
      if (!trimmed) return
      const exists = options.find(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase()
      )
      if (exists) {
        addTag(exists)
        return
      }
      try {
        const created = await createTagAction(trimmed)
        setOptions((prev) => [...prev, created])
        addTag(created)
      } catch {
        // ignore
      }
    },
    [options, addTag]
  )

  const filtered = query
    ? options.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) &&
          !selected.find((s) => s.id === t.id)
      )
    : options.filter((t) => !selected.find((s) => s.id === t.id))

  const showCreate =
    query.trim() &&
    !options.some((t) => t.name.toLowerCase() === query.trim().toLowerCase())

  return (
    <div className="flex flex-col gap-1.5">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="inline-flex opacity-60 hover:opacity-100"
                aria-label={`Remove ${tag.name}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Combobox>
        <ComboboxInput
          aria-label="Add tags"
          placeholder="Add tags…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              e.preventDefault()
              handleCreate(query)
            }
          }}
        />
        <ComboboxContent>
          <ComboboxList>
            {filtered.map((tag) => (
              <ComboboxItem
                key={tag.id}
                value={tag.id}
                onClick={() => addTag(tag)}
              >
                {tag.name}
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
              <ComboboxEmpty>No tags found</ComboboxEmpty>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {/* Hidden inputs for form submission */}
      {selected.map((tag) => (
        <input
          key={tag.id}
          type="hidden"
          name={name}
          value={tag.id}
          data-hidden-tag
        />
      ))}
    </div>
  )
}
