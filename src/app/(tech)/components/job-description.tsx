'use client'

import { useState } from 'react'
import { FileText, Save, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { saveJobDescriptionAction } from '@/app/(tech)/tech/jobs/actions'
import { toast } from 'sonner'

interface JobDescriptionProps {
  jobId: string
  initialDescription: string | null
}

export function JobDescription({ jobId, initialDescription }: JobDescriptionProps) {
  const [description, setDescription] = useState(initialDescription ?? '')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  function handleChange(value: string) {
    setDescription(value)
    setDirty(value !== (initialDescription ?? ''))
  }

  function handleCancel() {
    setDescription(initialDescription ?? '')
    setDirty(false)
  }

  async function handleSave() {
    setSaving(true)
    const result = await saveJobDescriptionAction(jobId, description)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      setDirty(false)
      toast.success('Description saved')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
        <CardTitle className="text-base">Description</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          value={description}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Describe the work to be done..."
          className="min-h-24 text-base"
          disabled={saving}
        />
        {dirty && (
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
              <RotateCcw className="mr-2 size-4" />
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              <Save className="mr-2 size-4" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
