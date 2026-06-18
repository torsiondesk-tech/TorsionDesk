'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { statusLabel } from '@/lib/jobs/transitions'
import { toast } from 'sonner'
import { updateStatusColorAction } from './actions'
import type { StatusColorEntry } from '@/lib/settings'

interface StatusColorsClientProps {
  initialColors: StatusColorEntry[]
}

export function StatusColorsClient({ initialColors }: StatusColorsClientProps) {
  const [colors, setColors] = useState(initialColors)
  const [isPending, startTransition] = useTransition()

  const handleColorChange = (
    index: number,
    field: 'bgColor' | 'textColor' | 'borderColor',
    value: string,
  ) => {
    setColors((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleSave = (index: number) => {
    const entry = colors[index]
    if (!entry) return

    startTransition(async () => {
      try {
        await updateStatusColorAction(entry.id, {
          bgColor: entry.bgColor,
          textColor: entry.textColor,
          borderColor: entry.borderColor,
        })
        toast.success(`Saved ${statusLabel(entry.status)} color`)
      } catch {
        toast.error('Failed to save color')
      }
    })
  }

  return (
    <div className="grid gap-4">
      {colors.map((entry, i) => (
        <div
          key={entry.id}
          className="flex items-center gap-4 rounded-lg border p-4"
          style={{
            backgroundColor: entry.bgColor,
            color: entry.textColor,
            borderColor: entry.borderColor,
          }}
        >
          <div className="w-40 shrink-0 font-semibold">{statusLabel(entry.status)}</div>

          <div className="flex flex-1 items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor={`bg-${entry.id}`} className="text-xs">BG</Label>
              <Input
                id={`bg-${entry.id}`}
                type="color"
                value={entry.bgColor}
                onChange={(e) => handleColorChange(i, 'bgColor', e.target.value)}
                className="h-8 w-12 p-0.5 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={`text-${entry.id}`} className="text-xs">Text</Label>
              <Input
                id={`text-${entry.id}`}
                type="color"
                value={entry.textColor}
                onChange={(e) => handleColorChange(i, 'textColor', e.target.value)}
                className="h-8 w-12 p-0.5 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={`border-${entry.id}`} className="text-xs">Border</Label>
              <Input
                id={`border-${entry.id}`}
                type="color"
                value={entry.borderColor}
                onChange={(e) => handleColorChange(i, 'borderColor', e.target.value)}
                className="h-8 w-12 p-0.5 cursor-pointer"
              />
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSave(i)}
            disabled={isPending}
          >
            Save
          </Button>
        </div>
      ))}
    </div>
  )
}
