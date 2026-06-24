"use client"

import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StarPickerProps {
  value: number | null
  onChange?: (rating: number) => void
  readOnly?: boolean
}

export function StarPicker({ value, onChange, readOnly }: StarPickerProps) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value !== null && star <= value
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(star)}
            className={cn(
              "p-0.5 transition-colors",
              readOnly ? "cursor-default" : "cursor-pointer hover:scale-105",
            )}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
          >
            <Star
              className={cn(
                "size-5",
                filled ? "fill-current text-yellow-400" : "fill-none text-muted-foreground",
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
