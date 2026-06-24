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
  createEstimateTaskAction,
  updateEstimateTaskAction,
  deleteEstimateTaskAction,
  createEstimateReminderAction,
  deleteEstimateReminderAction,
} from '../actions'
import { Plus, Trash2, Check, Clock } from 'lucide-react'

export interface EstimateTask {
  id: string
  label: string | null
  done: boolean | null
}

export interface EstimateReminder {
  id: string
  remindAt: Date | null
  note: string | null
  done: boolean | null
}

interface EstimateTasksProps {
  estimateId: string
  tasks: EstimateTask[]
  reminders: EstimateReminder[]
  onSiteDate?: string | null
  arrivalWindowStart?: string | null
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

interface ReminderPreset {
  label: string
  offsetMinutes: number
}

const REMINDER_PRESETS: ReminderPreset[] = [
  { label: 'Call customer 30 min before arrival', offsetMinutes: -30 },
  { label: 'Follow up on parts order', offsetMinutes: 60 * 24 * -2 },
  { label: 'Send estimate reminder', offsetMinutes: 60 * 24 * -1 },
  { label: 'Schedule return visit', offsetMinutes: 60 * 24 * 2 },
  { label: 'Confirm appointment day before', offsetMinutes: 60 * 24 * -1 },
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

function resolvePresetDateTime(
  onSiteDate: string | null | undefined,
  arrivalWindowStart: string | null | undefined,
): Date | null {
  if (!onSiteDate) return null
  const time = arrivalWindowStart || '08:00'
  const [hours, minutes] = time.split(':').map(Number)
  const base = new Date(onSiteDate)
  if (isNaN(base.getTime()) || isNaN(hours) || isNaN(minutes)) return null
  base.setHours(hours, minutes, 0, 0)
  return base
}

export function EstimateTasks({
  estimateId,
  tasks: initialTasks,
  reminders: initialReminders,
  onSiteDate,
  arrivalWindowStart,
}: EstimateTasksProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState<EstimateTask[]>(initialTasks)
  const [reminders, setReminders] = useState<EstimateReminder[]>(initialReminders)
  const [newTaskLabel, setNewTaskLabel] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [taskDeleting, setTaskDeleting] = useState<string | null>(null)
  const [reminderDeleting, setReminderDeleting] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  const [showReminderPresets, setShowReminderPresets] = useState(false)
  const [isAddingReminder, setIsAddingReminder] = useState(false)
  const [reminderSaving, setReminderSaving] = useState(false)

  // Sync from props when IDs change
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
      const result = await createEstimateTaskAction(estimateId, label.trim())
      setAddingTask(false)
      if (result.success) {
        setNewTaskLabel('')
        setShowPresets(false)
        router.refresh()
      }
    },
    [estimateId, router],
  )

  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null)

  const handleToggleTask = useCallback(
    async (taskId: string) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
      )
      setTogglingTaskId(taskId)
      const result = await updateEstimateTaskAction(taskId, estimateId, {
        done: !tasks.find((t) => t.id === taskId)?.done,
      })
      setTogglingTaskId(null)
      if (!result.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
        )
      }
      router.refresh()
    },
    [estimateId, tasks, router],
  )

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      const result = await deleteEstimateTaskAction(taskId, estimateId)
      if (result.success) {
        setTaskDeleting(null)
        router.refresh()
      }
    },
    [estimateId, router],
  )

  const handleAddReminder = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setReminderSaving(true)
      const fd = new FormData(e.currentTarget)
      const result = await createEstimateReminderAction(estimateId, {
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
    [estimateId, router],
  )

  const handleDeleteReminder = useCallback(
    async (reminderId: string) => {
      const result = await deleteEstimateReminderAction(reminderId, estimateId)
      if (result.success) {
        setReminderDeleting(null)
        router.refresh()
      }
    },
    [estimateId, router],
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
                className="group flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => handleToggleTask(task.id)}
                  disabled={togglingTaskId === task.id}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={`flex size-5 items-center justify-center rounded-full border ${
                      task.done
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30'
                    }`}
                  >
                    {task.done && <Check className="size-3" />}
                  </span>
                  <span className={`text-sm ${task.done ? 'line-through text-muted-foreground' : ''}`}>
                    {task.label}
                  </span>
                </button>

                <Dialog
                  open={taskDeleting === task.id}
                  onOpenChange={(open) => setTaskDeleting(open ? task.id : null)}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 opacity-0 group-hover:opacity-100"
                    onClick={() => setTaskDeleting(task.id)}
                  >
                    <Trash2 className="size-3 text-muted-foreground" />
                  </Button>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Delete task?</DialogTitle>
                      <DialogDescription>
                        This task will be removed permanently.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTaskDeleting(null)}>
                        Cancel
                      </Button>
                      <Button onClick={() => handleDeleteTask(task.id)} variant="destructive">
                        Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
              onClick={() => {
                setIsAddingReminder(true)
                setShowReminderPresets(false)
              }}
            >
              <Clock className="mr-1 size-3" /> Add Reminder
            </Button>
          </div>
        </div>

        {showReminderPresets && (
          <div className="flex flex-wrap gap-2">
            {REMINDER_PRESETS.map((preset) => {
              const base = resolvePresetDateTime(onSiteDate, arrivalWindowStart)
              const disabled = !base
              const remindAt = base
                ? new Date(base.getTime() + preset.offsetMinutes * 60_000)
                : null
              return (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => {
                    if (!remindAt) return
                    createEstimateReminderAction(estimateId, {
                      remindAt: remindAt.toISOString(),
                      note: preset.label,
                    }).then((result) => {
                      if (result.success) router.refresh()
                    })
                  }}
                >
                  {preset.label}
                </Button>
              )
            })}
          </div>
        )}

        {reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reminders yet.</p>
        ) : (
          <div className="space-y-1">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="group flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">
                      {reminder.remindAt
                        ? new Date(reminder.remindAt).toLocaleString()
                        : 'No date'}
                    </p>
                    {reminder.note && <p className="text-muted-foreground">{reminder.note}</p>}
                  </div>
                </div>

                <Dialog
                  open={reminderDeleting === reminder.id}
                  onOpenChange={(open) => setReminderDeleting(open ? reminder.id : null)}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 opacity-0 group-hover:opacity-100"
                    onClick={() => setReminderDeleting(reminder.id)}
                  >
                    <Trash2 className="size-3 text-muted-foreground" />
                  </Button>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Delete reminder?</DialogTitle>
                      <DialogDescription>
                        This reminder will be removed permanently.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setReminderDeleting(null)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleDeleteReminder(reminder.id)}
                        variant="destructive"
                      >
                        Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isAddingReminder} onOpenChange={setIsAddingReminder}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddReminder}>
            <DialogHeader>
              <DialogTitle>Add Reminder</DialogTitle>
              <DialogDescription>Set a follow-up reminder for this estimate.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="remindAt">Date &amp; time</Label>
                <Input
                  id="remindAt"
                  name="remindAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocalValue(new Date())}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Input id="note" name="note" placeholder="e.g. Follow up with customer" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddingReminder(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={reminderSaving}>Save Reminder</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
