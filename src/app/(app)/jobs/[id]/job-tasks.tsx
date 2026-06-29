'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  addJobTask,
  toggleJobTask,
  deleteJobTask,
  addJobReminder,
  deleteJobReminder,
} from '../actions'
import { Plus, Trash2, Check, Clock } from 'lucide-react'

export interface JobTask {
  id: string
  label: string | null
  done: boolean | null
}

export interface JobReminder {
  id: string
  remindAt: Date | null
  note: string | null
  done: boolean | null
}

interface JobTasksProps {
  jobId: string
  tasks: JobTask[]
  reminders: JobReminder[]
}

const TASK_PRESETS = [
  'Inspect cables',
  'Check spring tension',
  'Lubricate rollers',
  'Test safety sensors',
  'Verify door balance',
  'Check opener force settings',
  'Inspect weather stripping',
  'Clean tracks',
]

const REMINDER_PRESETS = [
  'Call customer 30 min before arrival',
  'Follow up on parts order',
  'Send invoice reminder',
  'Schedule return visit',
  'Confirm appointment day before',
]

function toDateTimeLocalValue(d: Date | string | null): string {
  if (!d) return ''
  const date = new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

export function JobTasks({ jobId, tasks: initialTasks, reminders: initialReminders }: JobTasksProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState<JobTask[]>(initialTasks)
  const [reminders, setReminders] = useState<JobReminder[]>(initialReminders)
  const [newTaskLabel, setNewTaskLabel] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [taskDeleting, setTaskDeleting] = useState<string | null>(null)
  const [reminderDeleting, setReminderDeleting] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  const [showReminderPresets, setShowReminderPresets] = useState(false)
  const [isAddingReminder, setIsAddingReminder] = useState(false)
  const [reminderSaving, setReminderSaving] = useState(false)

  // Sync from props
  if (
    initialTasks.length !== tasks.length ||
    initialTasks.some((t, i) => t.id !== tasks[i]?.id)
  ) {
    setTasks(initialTasks)
  }
  if (
    initialReminders.length !== reminders.length ||
    initialReminders.some((r, i) => r.id !== reminders[i]?.id)
  ) {
    setReminders(initialReminders)
  }

  const handleAddTask = useCallback(
    async (label: string) => {
      if (!label.trim()) return
      setAddingTask(true)
      const result = await addJobTask(jobId, label.trim())
      setAddingTask(false)
      if (result.success) {
        setNewTaskLabel('')
        setShowPresets(false)
        router.refresh()
      }
    },
    [jobId, router],
  )

  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null)

  const handleToggleTask = useCallback(
    async (taskId: string) => {
      // Optimistic: flip local state immediately so the UI feels responsive
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
      )
      setTogglingTaskId(taskId)
      const result = await toggleJobTask(taskId, jobId)
      setTogglingTaskId(null)
      if (!result.success) {
        // Revert on error
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
        )
      }
      router.refresh()
    },
    [jobId, router],
  )

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      const result = await deleteJobTask(taskId, jobId)
      if (result.success) {
        setTaskDeleting(null)
        router.refresh()
      }
    },
    [jobId, router],
  )

  const handleAddReminder = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setReminderSaving(true)
      const fd = new FormData(e.currentTarget)
      const result = await addJobReminder(jobId, {
        remindAt: (fd.get('remindAt') as string) || null,
        note: (fd.get('note') as string) || undefined,
      })
      setReminderSaving(false)
      if (result.success) {
        setIsAddingReminder(false)
        setShowReminderPresets(false)
        router.refresh()
      }
    },
    [jobId, router],
  )

  const handleDeleteReminder = useCallback(
    async (reminderId: string) => {
      const result = await deleteJobReminder(reminderId, jobId)
      if (result.success) {
        setReminderDeleting(null)
        router.refresh()
      }
    },
    [jobId, router],
  )

  return (
    <div className="space-y-6">
      {/* ── Tasks ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Task Checklist</h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPresets((s) => !s)}
            >
              Presets
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPresets(false)}
            >
              <Plus className="mr-1 size-3" /> Add Task
            </Button>
          </div>
        </div>

        {showPresets && (
          <div className="flex flex-wrap gap-2">
            {TASK_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddTask(preset)}
                disabled={addingTask}
              >
                {preset}
              </Button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            placeholder="New task…"
            value={newTaskLabel}
            onChange={(e) => setNewTaskLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddTask(newTaskLabel)
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            size="sm"
            disabled={!newTaskLabel.trim() || addingTask}
            onClick={() => handleAddTask(newTaskLabel)}
          >
            <Plus className="size-3" />
          </Button>
        </div>

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        ) : (
          <div className="space-y-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/50"
              >
                <button
                  type="button"
                  className="flex items-center gap-2 text-left"
                  disabled={togglingTaskId === task.id}
                  onClick={() => handleToggleTask(task.id)}
                >
                  <span
                    className={`inline-flex size-5 items-center justify-center rounded border ${
                      task.done
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input'
                    }`}
                  >
                    {task.done && <Check className="size-3.5" />}
                  </span>
                  <span
                    className={`text-sm ${
                      task.done ? 'text-muted-foreground line-through' : ''
                    }`}
                  >
                    {task.label}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setTaskDeleting(task.id)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Reminders ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Reminders</h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowReminderPresets((s) => !s)}
            >
              Presets
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAddingReminder(true)}
            >
              <Plus className="mr-1 size-3" /> Add Reminder
            </Button>
          </div>
        </div>

        {showReminderPresets && (
          <div className="flex flex-wrap gap-2">
            {REMINDER_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  addJobReminder(jobId, { note: preset })
                  setShowReminderPresets(false)
                  router.refresh()
                }}
              >
                {preset}
              </Button>
            ))}
          </div>
        )}

        {reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reminders yet.</p>
        ) : (
          <div className="space-y-2">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-start justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-4 text-muted-foreground" />
                  <div className="text-sm">
                    {reminder.remindAt && (
                      <div className="text-xs text-muted-foreground">
                        {toDateTimeLocalValue(reminder.remindAt)}
                      </div>
                    )}
                    <div>{reminder.note}</div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setReminderDeleting(reminder.id)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Reminder Dialog */}
      <Dialog open={isAddingReminder} onOpenChange={setIsAddingReminder}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Reminder</DialogTitle>
            <DialogDescription>Set a reminder for this job.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddReminder} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="remind-at">Remind At</Label>
              <Input
                id="remind-at"
                name="remindAt"
                type="datetime-local"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-note">Note</Label>
              <textarea
                id="reminder-note"
                name="note"
                placeholder="Reminder note…"
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsAddingReminder(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={reminderSaving}>
                {reminderSaving ? 'Saving…' : 'Add Reminder'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Task Dialog */}
      <Dialog open={!!taskDeleting} onOpenChange={(open) => { if (!open) setTaskDeleting(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this task?</DialogTitle>
            <DialogDescription>
              This task will be removed. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setTaskDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (taskDeleting) handleDeleteTask(taskDeleting) }}
            >
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Reminder Dialog */}
      <Dialog open={!!reminderDeleting} onOpenChange={(open) => { if (!open) setReminderDeleting(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this reminder?</DialogTitle>
            <DialogDescription>
              This reminder will be removed. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setReminderDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (reminderDeleting) handleDeleteReminder(reminderDeleting) }}
            >
              Delete Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
