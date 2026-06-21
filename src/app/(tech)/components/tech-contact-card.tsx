'use client'

import { useState } from 'react'
import { User, Phone, Mail, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { upsertTechContactAction } from '@/app/(tech)/tech/customers/actions'
import { createTechDb } from '@/app/(tech)/lib/dexie'
import { formatPhone, formatPhoneInput } from '@/lib/utils'
import { toast } from 'sonner'

interface ContactInfo {
  id: string
  firstName: string
  lastName: string | null
  phones: { id: string; number: string; isPrimary: boolean | null }[]
  emails: { id: string; address: string; isPrimary: boolean | null }[]
}

interface TechContactCardProps {
  orgId: string
  jobId: string
  customerId: string
  customerName: string
  contact: ContactInfo | null
}

export function TechContactCard({ orgId, jobId, customerId, customerName, contact }: TechContactCardProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const primaryPhone = contact?.phones.find((p) => p.isPrimary) ?? contact?.phones[0] ?? null
  const primaryEmail = contact?.emails.find((e) => e.isPrimary) ?? contact?.emails[0] ?? null

  const [firstName, setFirstName] = useState(contact?.firstName ?? '')
  const [lastName, setLastName] = useState(contact?.lastName ?? '')
  const [phone, setPhone] = useState(primaryPhone?.number ?? '')
  const [email, setEmail] = useState(primaryEmail?.address ?? '')

  function handleOpen(val: boolean) {
    if (val) {
      setFirstName(contact?.firstName ?? '')
      setLastName(contact?.lastName ?? '')
      setPhone(primaryPhone?.number ?? '')
      setEmail(primaryEmail?.address ?? '')
    }
    setOpen(val)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) {
      toast.error('First name is required')
      return
    }
    setSaving(true)
    const result = await upsertTechContactAction({
      customerId,
      contactId: contact?.id ?? null,
      jobId,
      firstName: firstName.trim(),
      lastName: lastName.trim() || null,
      phone: phone || null,
      email: email || null,
    })
    setSaving(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    const db = createTechDb(orgId)
    await db.jobs.update(jobId, {
      contactId: result.contactId,
      contactPhone: phone || null,
      contactEmail: email || null,
      contactFirstName: firstName.trim() || null,
      contactLastName: lastName.trim() || null,
    })
    toast.success('Contact saved')
    setOpen(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <User className="size-4 text-muted-foreground" aria-hidden="true" />
        <CardTitle className="text-base flex-1">Customer Info</CardTitle>
        <Dialog open={open} onOpenChange={handleOpen}>
          <DialogTrigger render={
            <Button type="button" variant="ghost" size="icon" className="-mr-2">
              <Pencil className="size-4" />
            </Button>
          } />
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="flex flex-col gap-3 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tc-first">First name *</Label>
                  <Input
                    id="tc-first"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))}
                    autoCapitalize="words"
                    placeholder="John"
                    autoFocus
                    className="text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tc-last">Last name</Label>
                  <Input
                    id="tc-last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))}
                    autoCapitalize="words"
                    placeholder="Smith"
                    className="text-base"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tc-phone">Phone</Label>
                <Input
                  id="tc-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  placeholder="(555) 000-0000"
                  className="text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tc-email">Email</Label>
                <Input
                  id="tc-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="text-base"
                />
              </div>
              <Button type="submit" disabled={saving} className="w-full mt-1">
                {saving ? 'Saving…' : 'Save Contact'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        <p className="font-medium">{customerName}</p>
        {contact ? (
          <>
            <p className="text-sm text-muted-foreground">
              {contact.firstName} {contact.lastName || ''}
            </p>
            {contact.phones.map((p) => (
              <a
                key={p.id}
                href={`tel:${p.number}`}
                className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400"
              >
                <Phone className="size-3.5 shrink-0" />
                {formatPhone(p.number)}
              </a>
            ))}
            {contact.emails.map((e) => (
              <a
                key={e.id}
                href={`mailto:${e.address}`}
                className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400"
              >
                <Mail className="size-3.5 shrink-0" />
                {e.address}
              </a>
            ))}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No contact on file — tap edit to add one.</p>
        )}
      </CardContent>
    </Card>
  )
}
