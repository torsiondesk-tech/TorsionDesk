'use client'

import { Phone, Mail, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { formatPhone, capitalizeWords } from '@/lib/utils'

export interface ContactPhone {
  number: string
  ext: string
  type: 'cell' | 'home' | 'work'
  isPrimary: boolean
}

export interface ContactEmail {
  address: string
  type: 'work' | 'personal'
  isPrimary: boolean
}

export interface ContactEditorValue {
  firstName: string
  lastName: string
  jobTitle: string
  phones: ContactPhone[]
  emails: ContactEmail[]
  billingContact: boolean
  bookingContact: boolean
  smsConsent: boolean
}

export function emptyContact(): ContactEditorValue {
  return {
    firstName: '',
    lastName: '',
    jobTitle: '',
    phones: [{ number: '', ext: '', type: 'cell', isPrimary: true }],
    emails: [{ address: '', type: 'work', isPrimary: true }],
    billingContact: true,
    bookingContact: false,
    smsConsent: true,
  }
}

interface ContactEditorProps {
  value: ContactEditorValue
  onChange: (val: ContactEditorValue) => void
  idPrefix?: string
}

export function ContactEditor({ value, onChange, idPrefix = 'ce' }: ContactEditorProps) {
  const set = (patch: Partial<ContactEditorValue>) => onChange({ ...value, ...patch })

  const setPhone = (i: number, patch: Partial<ContactPhone>) =>
    onChange({ ...value, phones: value.phones.map((p, idx) => idx === i ? { ...p, ...patch } : p) })
  const addPhone = () =>
    onChange({ ...value, phones: [...value.phones, { number: '', ext: '', type: 'cell', isPrimary: false }] })
  const removePhone = (i: number) =>
    onChange({ ...value, phones: value.phones.filter((_, idx) => idx !== i) })

  const setEmail = (i: number, patch: Partial<ContactEmail>) =>
    onChange({ ...value, emails: value.emails.map((e, idx) => idx === i ? { ...e, ...patch } : e) })
  const addEmail = () =>
    onChange({ ...value, emails: [...value.emails, { address: '', type: 'work', isPrimary: false }] })
  const removeEmail = (i: number) =>
    onChange({ ...value, emails: value.emails.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-first`}>First Name</Label>
          <Input
            id={`${idPrefix}-first`}
            value={value.firstName}
            onChange={(e) => set({ firstName: capitalizeWords(e.target.value) })}
            autoCapitalize="words"
            placeholder="First name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-last`}>Last Name</Label>
          <Input
            id={`${idPrefix}-last`}
            value={value.lastName}
            onChange={(e) => set({ lastName: capitalizeWords(e.target.value) })}
            autoCapitalize="words"
            placeholder="Last name"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Job Title</Label>
        <Input
          id={`${idPrefix}-title`}
          value={value.jobTitle}
          onChange={(e) => set({ jobTitle: e.target.value })}
          placeholder="e.g. Property Manager"
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone Numbers</div>
        {value.phones.map((phone, i) => (
          <div key={i} className="flex items-center gap-2">
            <Phone className="size-4 shrink-0 text-muted-foreground" />
            <Input
              aria-label={`Phone number ${i + 1}`}
              type="tel"
              placeholder="(555) 000-0000"
              value={formatPhone(phone.number)}
              onChange={(e) => setPhone(i, { number: e.target.value.replace(/\D/g, '') })}
              className="flex-1 min-w-0"
            />
            <Input
              aria-label={`Phone ${i + 1} extension`}
              placeholder="Ext"
              value={phone.ext}
              onChange={(e) => setPhone(i, { ext: e.target.value.replace(/\D/g, '') })}
              className="w-16 shrink-0"
            />
            <Select value={phone.type} onValueChange={(v) => setPhone(i, { type: v as ContactPhone['type'] })}>
              <SelectTrigger className="h-9 w-[90px] shrink-0" aria-label={`Phone ${i + 1} type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cell">cell</SelectItem>
                <SelectItem value="home">home</SelectItem>
                <SelectItem value="work">work</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id={`${idPrefix}-pp-${i}`}
                checked={phone.isPrimary}
                onCheckedChange={(c) => setPhone(i, { isPrimary: c === true })}
              />
              <Label htmlFor={`${idPrefix}-pp-${i}`} className="cursor-pointer text-xs">Primary</Label>
            </div>
            {value.phones.length > 1 && (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => removePhone(i)}>
                <X className="size-3" />
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={addPhone}>
          <Plus className="mr-1 size-3" />
          Add phone
        </Button>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email Addresses</div>
        {value.emails.map((email, i) => (
          <div key={i} className="flex items-center gap-2">
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <Input
              aria-label={`Email address ${i + 1}`}
              type="email"
              placeholder="name@company.com"
              value={email.address}
              onChange={(e) => setEmail(i, { address: e.target.value })}
              className="max-w-[280px]"
            />
            <Select value={email.type} onValueChange={(v) => setEmail(i, { type: v as ContactEmail['type'] })}>
              <SelectTrigger className="h-9 w-[100px]" aria-label={`Email ${i + 1} type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="work">work</SelectItem>
                <SelectItem value="personal">personal</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id={`${idPrefix}-ep-${i}`}
                checked={email.isPrimary}
                onCheckedChange={(c) => setEmail(i, { isPrimary: c === true })}
              />
              <Label htmlFor={`${idPrefix}-ep-${i}`} className="cursor-pointer text-xs">Primary</Label>
            </div>
            {value.emails.length > 1 && (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => removeEmail(i)}>
                <X className="size-3" />
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={addEmail}>
          <Plus className="mr-1 size-3" />
          Add email
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-billing`}
            checked={value.billingContact}
            onCheckedChange={(c) => set({ billingContact: c === true })}
          />
          <Label htmlFor={`${idPrefix}-billing`} className="cursor-pointer">Billing Contact</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-booking`}
            checked={value.bookingContact}
            onCheckedChange={(c) => set({ bookingContact: c === true })}
          />
          <Label htmlFor={`${idPrefix}-booking`} className="cursor-pointer">Booking Contact</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-sms`}
            checked={value.smsConsent}
            onCheckedChange={(c) => set({ smsConsent: c === true })}
          />
          <Label htmlFor={`${idPrefix}-sms`} className="cursor-pointer">SMS Consent</Label>
        </div>
      </div>
    </div>
  )
}
