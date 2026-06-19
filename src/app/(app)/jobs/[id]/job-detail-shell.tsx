'use client'

import { useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { JobForm, type JobFormData } from './job-form'
import { JobSummary } from './job-summary'
import { SiteVisits } from './site-visits'
import { JobTasks } from './job-tasks'
import type { JobDetail } from '@/lib/jobs/jobs'
import type { TagOption } from '@/components/tag-select'

interface ReferenceData {
  jobCategories: Array<{ id: string; name: string; parentId: string | null }>
  jobSources: Array<{ id: string; name: string }>
  taxItems: Array<{ id: string; name: string; rate: string | null }>
  availableTags: TagOption[]
  productCategories: Array<{ id: string; name: string }>
  orgMembers: Array<{ id: string; label: string }>
}

interface JobDetailShellProps {
  job: JobDetail
  initial: JobFormData
  referenceData: ReferenceData
  orgMembers: Array<{ id: string; label: string }>
  categoryName?: string
  sourceName?: string
  initialEdit?: boolean
}

export function JobDetailShell({
  job,
  initial,
  referenceData,
  orgMembers,
  categoryName,
  sourceName,
  initialEdit = false,
}: JobDetailShellProps) {
  const [isEditing, setIsEditing] = useState(initialEdit)

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
          <div className="flex justify-end">
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
            categoryName={categoryName}
            sourceName={sourceName}
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
