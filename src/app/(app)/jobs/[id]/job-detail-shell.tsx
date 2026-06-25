'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { JobForm, type JobFormData } from './job-form'
import { JobSummary } from './job-summary'
import { SiteVisits } from './site-visits'
import { JobTasks } from './job-tasks'
import { createInvoiceFromJobAction } from '@/app/(app)/invoices/actions'
import type { JobDetail } from '@/lib/jobs/jobs'
import type { TagOption } from '@/components/tag-select'

interface ReferenceData {
  jobCategories: Array<{ id: string; name: string; parentId: string | null }>
  jobSources: Array<{ id: string; name: string }>
  taxItems: Array<{ id: string; name: string; rate: string | null }>
  availableTags: TagOption[]
  productCategories: Array<{ id: string; name: string }>
  orgMembers: Array<{ id: string; label: string; role: string | null }>
  salesReps: Array<{ id: string; name: string }>
}

interface JobDetailShellProps {
  orgId: string
  job: JobDetail
  initial: JobFormData
  referenceData: ReferenceData
  orgMembers: Array<{ id: string; label: string; role: string | null }>
  categoryName?: string
  sourceName?: string
  initialEdit?: boolean
  invoice?: { id: string; invoiceNo: number; invoiceDate: string | null } | null
}

export function JobDetailShell({
  orgId,
  job,
  initial,
  referenceData,
  orgMembers,
  categoryName,
  sourceName,
  initialEdit = false,
  invoice,
}: JobDetailShellProps) {
  const [isEditing, setIsEditing] = useState(initialEdit)
  const router = useRouter()
  const [isCreatingInvoice, startCreateInvoice] = useTransition()

  const showCreateInvoice = job.status === 'completed' && !invoice

  return (
    <div className="space-y-6">
      {isEditing ? (
        <>
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
          <JobForm
            mode="edit"
            initial={initial}
            referenceData={referenceData}
            primaryLocationId={job.primaryLocationId}
            primaryContactId={job.primaryContactId}
            onSuccess={() => setIsEditing(false)}
            onCancel={() => setIsEditing(false)}
            rightPanelExtras={
              <>
                <SiteVisits jobId={job.id} visits={job.siteVisits} />
                <JobTasks
                  jobId={job.id}
                  tasks={job.tasks}
                  reminders={job.reminders}
                />
              </>
            }
          />
        </>
      ) : (
        <>
          <div className="flex justify-end gap-2">
            {showCreateInvoice && (
              <Button
                type="button"
                size="sm"
                className="gap-2"
                disabled={isCreatingInvoice}
                onClick={() => {
                  startCreateInvoice(async () => {
                    const result = await createInvoiceFromJobAction(orgId, job.id)
                    if (result.error) {
                      toast.error(result.error)
                      return
                    }
                    toast.success(`Invoice #INV-${result.invoiceNo} created.`)
                    router.push(`/invoices/${result.invoiceId}`)
                    router.refresh()
                  })
                }}
              >
                <FileText className="size-4" />
                Create Invoice
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-4" />
              Edit Job
            </Button>
          </div>
          <JobSummary
            job={job}
            orgMembers={orgMembers}
            salesReps={referenceData.salesReps}
            categoryName={categoryName}
            sourceName={sourceName}
            taxItems={referenceData.taxItems}
          />
          <SiteVisits jobId={job.id} visits={job.siteVisits} />
          <JobTasks
            jobId={job.id}
            tasks={job.tasks}
            reminders={job.reminders}
          />
        </>
      )}
    </div>
  )
}
