'use client'

import { useState, useMemo } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createTechDb } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, type NotePayload } from '@/app/(tech)/lib/sync'
import { saveCompletionNotesAction } from '@/app/(tech)/tech/jobs/actions'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { toast } from 'sonner'

interface CompletionNotesProps {
  orgId: string
  jobId: string
  initialNotes: string | null
}

export function CompletionNotes({ orgId, jobId, initialNotes }: CompletionNotesProps) {
  const db = useMemo(() => createTechDb(orgId), [orgId])
  const online = useOnline()

  const [notes, setNotes] = useState(initialNotes ?? '')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  async function handleSave() {
    setSaving(true)
    if (online) {
      const result = await saveCompletionNotesAction(jobId, notes)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        setDirty(false)
        toast.success('Notes saved')
      }
    } else {
      await enqueueOutboxItem(orgId, {
        type: 'job_note',
        payload: { jobId, notes } satisfies NotePayload,
      })
      await db.jobs.update(jobId, { completionNotes: notes })
      setDirty(false)
      toast.info('Queued completion notes — will sync when online')
    }
    setSaving(false)
  }

  function handleChange(value: string) {
    setNotes(value)
    setDirty(value !== (initialNotes ?? ''))
  }

  function handleCancel() {
    if (dirty) {
      setDiscardOpen(true)
    } else {
      resetNotes()
    }
  }

  function resetNotes() {
    setNotes(initialNotes ?? '')
    setDirty(false)
    setDiscardOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <Textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Add completion notes for the office..."
        className="min-h-40 text-base"
        disabled={saving}
      />

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={saving}
        >
          <RotateCcw className="mr-2 size-4" />
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          <Save className="mr-2 size-4" />
          {saving ? 'Saving...' : 'Save Notes'}
        </Button>
      </div>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard note?</DialogTitle>
            <DialogDescription>You have unsaved changes. Discard them?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>Keep editing</Button>
            <Button variant="destructive" onClick={resetNotes}>Discard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
