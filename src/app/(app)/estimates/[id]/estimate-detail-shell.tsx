'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, X, FileDown, Mail, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TimeWindowPicker } from '@/components/ui/time-window-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EstimateForm } from './estimate-form'
import { EstimateSummary } from './estimate-summary'
import { EstimateTasks } from './estimate-tasks'
import { convertEstimateToJobAction, sendEstimateAction } from '../actions'
import { toast } from 'sonner'
import type { getEstimateAction } from '../actions'
import type { TagOption } from '@/components/tag-select'
import type { EstimateTemplate } from '@/lib/estimates/templates'

interface ReferenceData {
  jobCategories: Array<{ id: string; name: string; parentId: string | null }>
  referralSources: Array<{ id: string; name: string }>
  taxItems: Array<{ id: string; name: string; rate: string | null }>
  availableTags: TagOption[]
  productCategories: Array<{ id: string; name: string }>
  orgMembers: Array<{ id: string; label: string; role: string | null }>
  salesReps: Array<{ id: string; name: string }>
}

interface EstimateDetailShellProps {
  orgId: string
  userId: string
  role?: string | null
  estimateId: string
  initial: NonNullable<Awaited<ReturnType<typeof getEstimateAction>>> & {
    customerName?: string | null
  }
  referenceData: ReferenceData
  estimateTemplates: EstimateTemplate[]
  initialEdit?: boolean
  initialConvertOpen?: boolean
}

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function fmtTime24(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return ''
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

export function EstimateDetailShell({
  orgId,
  userId,
  role,
  estimateId,
  initial,
  referenceData,
  estimateTemplates,
  initialEdit = false,
  initialConvertOpen = false,
}: EstimateDetailShellProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(initialEdit)
  const [converting, setConverting] = useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = useState(initialConvertOpen)
  const [scheduledDate, setScheduledDate] = useState(toDateInputValue(initial.estimate.onSiteDate))
  const [scheduledTimeStart, setScheduledTimeStart] = useState(fmtTime24(initial.estimate.arrivalWindowStart))
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState(fmtTime24(initial.estimate.arrivalWindowEnd))
  const [conversionNote, setConversionNote] = useState('')

  const isLost = initial.estimate.status === 'estimate_lost'
  const hasConvertedJobs = (initial.convertedJobs?.length ?? 0) > 0

  const handleEmail = async () => {
    try {
      await sendEstimateAction(orgId, estimateId)
      toast('Email sending arrives in a later release. The estimate PDF is ready to download.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send estimate.')
    }
  }

  const handleConvert = async () => {
    setConverting(true)
    try {
      const result = await convertEstimateToJobAction(orgId, estimateId, {
        scheduledDate: scheduledDate || null,
        scheduledTimeStart: scheduledTimeStart || null,
        scheduledTimeEnd: scheduledTimeEnd || null,
        note: conversionNote || null,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Converted to job')
      router.push(`/jobs/${result.jobId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not convert estimate.')
    } finally {
      setConverting(false)
      setConvertDialogOpen(false)
    }
  }

  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setIsEditing(false)}
          >
            <X className="size-4" />
            Cancel
          </Button>
        </div>
        <EstimateForm
          mode="edit"
          orgId={orgId}
          userId={userId}
          role={role}
          estimateId={estimateId}
          initial={initial}
          referenceData={referenceData}
          estimateTemplates={estimateTemplates}
          onSuccess={() => setIsEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={`/api/estimates/${estimateId}/pdf`} target="_blank" passHref>
          <Button variant="outline" size="sm" type="button">
            <FileDown className="mr-1 size-4" />
            Download PDF
          </Button>
        </Link>
        <Button variant="outline" size="sm" type="button" onClick={handleEmail}>
          <Mail className="mr-1 size-4" />
          Email Estimate
        </Button>
        <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
          <DialogTrigger
            render={(props) => (
              <Button
                {...props}
                variant="outline"
                size="sm"
                disabled={isLost}
                type="button"
              >
                <Send className="mr-1 size-4" />
                Convert to Job
              </Button>
            )}
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Convert to Job</DialogTitle>
              <DialogDescription className="space-y-2">
                <p>
                  This creates a new job from this estimate, copies the line items and groups, and
                  marks the estimate as Won.
                </p>
                {hasConvertedJobs && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <strong>
                      This estimate is already converted to{' '}
                      {initial.convertedJobs
                        .map((j, i) => `${i > 0 ? ', ' : ''}Job #JOB-${j.jobNo}`)
                        .join('')}
                      .
                    </strong>
                    <br />
                    Clicking Convert again will create another duplicate job.
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="convert-scheduled-date">Scheduled Date</Label>
                <Input
                  id="convert-scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to create the job as Unscheduled.
                </p>
              </div>

              {scheduledDate && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium leading-none">Arrival Window</p>
                  <TimeWindowPicker
                    startValue={scheduledTimeStart}
                    endValue={scheduledTimeEnd}
                    onStartChange={setScheduledTimeStart}
                    onEndChange={setScheduledTimeEnd}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="convert-note">Note for Techs</Label>
                <Textarea
                  id="convert-note"
                  placeholder="Add a note about this appointment..."
                  value={conversionNote}
                  onChange={(e) => setConversionNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConvert}
                disabled={converting}
                variant={hasConvertedJobs ? 'destructive' : 'default'}
              >
                {converting && <Loader2 className="mr-1 size-4 animate-spin" />}
                {hasConvertedJobs ? 'Convert Anyway' : 'Convert'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="size-4" />
          Edit Estimate
        </Button>
      </div>

      <EstimateSummary initial={initial} referenceData={referenceData} />

      <EstimateTasks
        estimateId={estimateId}
        tasks={initial.tasks.map((t) => ({ id: t.id, label: t.label, done: t.done }))}
        reminders={initial.reminders.map((r) => ({
          id: r.id,
          remindAt: r.remindAt,
          note: r.note,
          done: r.done,
        }))}
        onSiteDate={initial.estimate.onSiteDate?.toISOString().slice(0, 10)}
        arrivalWindowStart={
          initial.estimate.arrivalWindowStart
            ? initial.estimate.arrivalWindowStart.toISOString().slice(11, 16)
            : initial.estimate.arrivalWindowEnd
              ? initial.estimate.arrivalWindowEnd.toISOString().slice(11, 16)
              : null
        }
      />
    </div>
  )
}
