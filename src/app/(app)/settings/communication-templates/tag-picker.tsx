'use client'

import { useMemo, useState } from 'react'
import { Search, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getTagsForCategory, type TemplateCategory, type TagDef } from '@/lib/comms/template-tags'
import { cn } from '@/lib/utils'

interface TagPickerProps {
  category: TemplateCategory
  channel: 'email' | 'sms'
  mode: 'subject' | 'body'
  onInsertTag: (tagLiteral: string) => void
}

const SCOPE_ORDER = ['Customer', 'Invoice', 'Job', 'Estimate', 'Company', 'General']

export function TagPicker({ category, channel, mode, onInsertTag }: TagPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const tags = useMemo(() => {
    const all = getTagsForCategory(category, channel)
    if (mode === 'subject') {
      return all.filter((tag) => !tag.isHtml)
    }
    return all
  }, [category, channel, mode])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tags
    return tags.filter(
      (tag) =>
        tag.label.toLowerCase().includes(q) ||
        tag.key.toLowerCase().includes(q) ||
        tag.scope.toLowerCase().includes(q) ||
        tag.description.toLowerCase().includes(q),
    )
  }, [tags, query])

  const grouped = useMemo(() => {
    const byScope = new Map<string, TagDef[]>()
    for (const tag of filtered) {
      const list = byScope.get(tag.scope) ?? []
      list.push(tag)
      byScope.set(tag.scope, list)
    }
    return SCOPE_ORDER.map((scope) => ({ scope, tags: byScope.get(scope) ?? [] })).filter(
      (g) => g.tags.length > 0,
    )
  }, [filtered])

  function handleInsert(tag: TagDef) {
    onInsertTag(`{${tag.scope}.${tag.key}}`)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <Button
            {...props}
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Tag className="size-3.5" />
            Insert tag
          </Button>
        )}
      />
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tags..."
              className="h-8 pl-7 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-2 space-y-3">
          {grouped.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No tags match your search.</p>
          )}
          {grouped.map((group) => (
            <div key={group.scope}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {group.scope}
              </p>
              <div className="space-y-1">
                {group.tags.map((tag) => (
                  <button
                    key={`${tag.scope}.${tag.key}`}
                    type="button"
                    onClick={() => handleInsert(tag)}
                    className={cn(
                      'w-full text-left rounded-md px-2 py-1.5 transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      tag.isHtml && 'border-l-2 border-l-primary',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{tag.label}</span>
                      <code className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
                        {'{'}{tag.scope}.{tag.key}{'}'}
                      </code>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {tag.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
