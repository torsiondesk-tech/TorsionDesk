'use client'

import { useState, useCallback, useRef } from 'react'
import { MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  searchPlacesAction,
  getPlaceDetailsAction,
  type PlaceSuggestion,
  type ParsedAddress,
} from '@/lib/places-actions'

interface AddressAutocompleteProps {
  id?: string
  name?: string
  defaultValue?: string
  placeholder?: string
  onAddressSelect?: (result: ParsedAddress) => void
}

export function AddressAutocomplete({
  id,
  name,
  defaultValue = '',
  placeholder = 'Start typing an address…',
  onAddressSelect,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }
    setLoading(true)
    setOpen(true)
    try {
      const results = await searchPlacesAction(q)
      setSuggestions(results)
      setOpen(results.length > 0 || loading)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      setInputValue(v)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => search(v), 300)
    },
    [search],
  )

  const handleSelect = useCallback(
    async (suggestion: PlaceSuggestion) => {
      setInputValue(suggestion.description)
      setOpen(false)
      setSuggestions([])
      const details = await getPlaceDetailsAction(suggestion.placeId)
      if (details) {
        setInputValue(details.addressLine1)
        onAddressSelect?.(details)
      }
    },
    [onAddressSelect],
  )

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {loading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
          ) : (
            suggestions.map((s) => (
              <button
                key={s.placeId}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                onMouseDown={() => handleSelect(s)}
              >
                <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                {s.description}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
