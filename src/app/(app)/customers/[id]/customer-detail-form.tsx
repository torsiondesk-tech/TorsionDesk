'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Save,
  X,
  Plus,
  Trash2,
  Phone,
  Mail,
  Merge,
  AlertTriangle,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPhone } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updateCustomerDetail, deactivateCustomer, setPrimaryContactAction } from '../actions'
import { TagSelect, type TagOption } from '@/components/tag-select'
import { ReferralSelect, type ReferralOption } from '@/components/referral-select'
import { CustomerSearch } from '@/components/customer-search'
import { ActivitySidebar } from './activity-sidebar'
import { LocationsSection } from './locations-section'

// ── Types ──────────────────────────────────────────────────────────────────

interface ContactFormState {
  id: string
  firstName: string
  lastName: string
  jobTitle: string
  birthday: string
  anniversary: string
  smsConsent: boolean
  billingContact: boolean
  bookingContact: boolean
  phones: Array<{ number: string; type: string; isPrimary: boolean }>
  emails: Array<{ address: string; type: string; isPrimary: boolean }>
}

interface LocationRow {
  id: string
  name: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  gated: boolean | null
  equipment: Array<{
    id: string
    kind: 'door' | 'opener' | 'spring'
    brand: string | null
    widthFt: string | null
    heightFt: string | null
    model: string | null
    wireSize: string | null
    insideDiameter: string | null
    length: string | null
    windDirection: 'left' | 'right' | 'pair' | null
  }>
}

interface EventRow {
  id: string
  kind: string
  title: string | null
  body: string | null
  occurredAt: Date | null
  actor: string | null
}

interface CustomerDetailFormProps {
  customer: {
    id: string
    name: string
    accountNo: number
    active: boolean | null
    vip: boolean | null
    taxable: boolean | null
    parentCustomerId: string | null
    assignedAgentId: string | null
    referralSourceId: string | null
    internalNotes: string | null
    publicNotes: string | null
  }
  contacts: Array<{
    id: string
    firstName: string
    lastName: string | null
    jobTitle: string | null
    birthday: string | null
    anniversary: string | null
    smsConsent: boolean | null
    billingContact: boolean | null
    bookingContact: boolean | null
    phones: Array<{
      id: string
      number: string
      type: string
      isPrimary: boolean | null
    }>
    emails: Array<{
      id: string
      address: string
      type: string
      isPrimary: boolean | null
    }>
  }>
  locations: LocationRow[]
  primaryLocationId: string | null
  primaryContactId: string | null
  tagNames: string[]
  events: EventRow[]
  availableTags: TagOption[]
  referralOptions: ReferralOption[]
  parentCustomerLabel?: string
  jobs?: Array<{
    id: string
    jobNo: number
    description: string | null
    status: string
    startDate: Date | null
  }>
}

// ── Component ──────────────────────────────────────────────────────────────

export function CustomerDetailForm({
  customer,
  contacts: initialContacts,
  locations,
  primaryLocationId,
  primaryContactId: initialPrimaryContactId,
  tagNames,
  events,
  availableTags,
  referralOptions,
  parentCustomerLabel,
  jobs = [],
}: CustomerDetailFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // UI state
  const [activeTab, setActiveTab] = useState('account')
  const [primaryContactId, setPrimaryContactId] = useState(initialPrimaryContactId)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  // Customer fields
  const [name, setName] = useState(customer.name)
  const [vip, setVip] = useState(customer.vip ?? false)
  const [active, setActive] = useState(customer.active ?? true)
  const [taxable, setTaxable] = useState(customer.taxable ?? true)
  const [parentCustomerId, setParentCustomerId] = useState(
    customer.parentCustomerId,
  )
  const [assignedAgentId, setAssignedAgentId] = useState(
    customer.assignedAgentId ?? '',
  )
  const [referralSourceId, setReferralSourceId] = useState(
    customer.referralSourceId,
  )
  const [internalNotes, setInternalNotes] = useState(
    customer.internalNotes ?? '',
  )
  const [publicNotes, setPublicNotes] = useState(customer.publicNotes ?? '')

  // Tags
  const initialTagIds = tagNames
    .map((n) => availableTags.find((t) => t.name === n)?.id)
    .filter((id): id is string => !!id)
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds)

  // Contacts
  const emptyContact = (): ContactFormState => ({
    id: '',
    firstName: '',
    lastName: '',
    jobTitle: '',
    birthday: '',
    anniversary: '',
    smsConsent: false,
    billingContact: false,
    bookingContact: false,
    phones: [{ number: '', type: 'cell', isPrimary: true }],
    emails: [{ address: '', type: 'work', isPrimary: true }],
  })

  const [contactsState, setContactsState] = useState<ContactFormState[]>(() => {
    if (initialContacts.length === 0) return [emptyContact()]
    return initialContacts.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName ?? '',
      jobTitle: c.jobTitle ?? '',
      birthday: c.birthday ?? '',
      anniversary: c.anniversary ?? '',
      smsConsent: c.smsConsent ?? false,
      billingContact: c.billingContact ?? false,
      bookingContact: c.bookingContact ?? false,
      phones:
        c.phones.length > 0
          ? c.phones.map((p) => ({
              number: p.number,
              type: p.type,
              isPrimary: p.isPrimary ?? false,
            }))
          : [{ number: '', type: 'cell', isPrimary: true }],
      emails:
        c.emails.length > 0
          ? c.emails.map((e) => ({
              address: e.address,
              type: e.type,
              isPrimary: e.isPrimary ?? false,
            }))
          : [{ address: '', type: 'work', isPrimary: true }],
    }))
  })

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSave = (andClose = false) => {
    setError('')
    setSuccess(false)

    const payloadContacts = contactsState
      .filter((c) => c.firstName.trim())
      .map((c) => ({
        id: c.id || undefined,
        firstName: c.firstName.trim(),
        lastName: c.lastName.trim() || null,
        jobTitle: c.jobTitle.trim() || null,
        birthday: c.birthday || null,
        anniversary: c.anniversary || null,
        smsConsent: c.smsConsent,
        billingContact: c.billingContact,
        bookingContact: c.bookingContact,
        phones: c.phones.filter((p) => p.number.trim()),
        emails: c.emails.filter((e) => e.address.trim()),
      }))

    startTransition(async () => {
      const result = await updateCustomerDetail({
        id: customer.id,
        name: name.trim(),
        vip,
        active,
        taxable,
        parentCustomerId: parentCustomerId || null,
        assignedAgentId: assignedAgentId.trim() || null,
        referralSourceId: referralSourceId || null,
        internalNotes: internalNotes.trim() || null,
        publicNotes: publicNotes.trim() || null,
        tagIds,
        contacts: payloadContacts,
      })

      if (result.success) {
        setSuccess(true)
        if (andClose) {
          router.push('/customers')
        } else {
          router.refresh()
        }
      } else {
        setError(result.error ?? 'Save failed.')
      }
    })
  }

  const handleDeactivate = async () => {
    setDeactivating(true)
    try {
      await deactivateCustomer(customer.id)
      router.push('/customers')
    } finally {
      setDeactivating(false)
      setDeactivateOpen(false)
    }
  }

  // Contact helpers
  const updateContact = (
    ci: number,
    field: keyof ContactFormState,
    value: unknown,
  ) => {
    setContactsState((prev) => {
      const next = [...prev]
      next[ci] = { ...next[ci], [field]: value }
      return next
    })
  }

  const updateContactPhone = (
    ci: number,
    pi: number,
    field: 'number' | 'type' | 'isPrimary',
    value: string | boolean,
  ) => {
    setContactsState((prev) => {
      const next = [...prev]
      const phones = [...next[ci].phones]
      phones[pi] = { ...phones[pi], [field]: value }
      next[ci] = { ...next[ci], phones }
      return next
    })
  }

  const addContactPhone = (ci: number) => {
    setContactsState((prev) => {
      const next = [...prev]
      next[ci] = {
        ...next[ci],
        phones: [
          ...next[ci].phones,
          { number: '', type: 'cell', isPrimary: false },
        ],
      }
      return next
    })
  }

  const removeContactPhone = (ci: number, pi: number) => {
    setContactsState((prev) => {
      const next = [...prev]
      next[ci] = {
        ...next[ci],
        phones: next[ci].phones.filter((_, i) => i !== pi),
      }
      return next
    })
  }

  const updateContactEmail = (
    ci: number,
    ei: number,
    field: 'address' | 'type' | 'isPrimary',
    value: string | boolean,
  ) => {
    setContactsState((prev) => {
      const next = [...prev]
      const emails = [...next[ci].emails]
      emails[ei] = { ...emails[ei], [field]: value }
      next[ci] = { ...next[ci], emails }
      return next
    })
  }

  const addContactEmail = (ci: number) => {
    setContactsState((prev) => {
      const next = [...prev]
      next[ci] = {
        ...next[ci],
        emails: [
          ...next[ci].emails,
          { address: '', type: 'work', isPrimary: false },
        ],
      }
      return next
    })
  }

  const removeContactEmail = (ci: number, ei: number) => {
    setContactsState((prev) => {
      const next = [...prev]
      next[ci] = {
        ...next[ci],
        emails: next[ci].emails.filter((_, i) => i !== ei),
      }
      return next
    })
  }

  const addContact = () => setContactsState((prev) => [...prev, emptyContact()])
  const removeContact = (ci: number) =>
    setContactsState((prev) => prev.filter((_, i) => i !== ci))

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 animate-in fade-in-0 duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            {name || customer.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">
              Acct #{customer.accountNo}
            </span>
            {vip && <Badge variant="secondary">VIP</Badge>}
            <Badge variant={active ? 'outline' : 'secondary'}>
              {active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleSave(true)}
            disabled={isPending}
            className="gap-1"
          >
            <Save className="size-4" />
            Save &amp; Close
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={isPending}
          >
            Save
          </Button>

          <Link
            href={`/jobs/new?customerId=${customer.id}&contactId=${initialContacts[0]?.id ?? ''}&locationId=${primaryLocationId ?? locations[0]?.id ?? ''}`}
          >
            <Button size="sm" variant="outline">
              New Job
            </Button>
          </Link>

          <Button
            size="sm"
            variant="outline"
            disabled
            title="Available in a later release"
          >
            New Estimate
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => router.push(`/customers/merge?a=${customer.id}`)}
          >
            <Merge className="size-3.5" />
            Merge
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeactivateOpen(true)}
          >
            Deactivate
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-600">
          Saved successfully.
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-9 w-full justify-start overflow-x-auto rounded-md bg-muted p-1">
          <TabsTrigger value="account" className="text-xs">
            Account Info
          </TabsTrigger>
          <TabsTrigger value="jobs" className="text-xs">
            Jobs
          </TabsTrigger>
          <TabsTrigger value="financial" className="text-xs">
            Financial Data
          </TabsTrigger>
          <TabsTrigger value="locations" className="text-xs">
            Service Locations
          </TabsTrigger>
          <TabsTrigger value="equipment" className="text-xs">
            Equipment
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">
            Documents
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            History
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            {/* Main column */}
            <div className="space-y-6">
              {/* Account Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    Account Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cust-name">Customer Name *</Label>
                      <Input
                        id="cust-name"
                        value={name}
                        onChange={(e) => setName(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))}
                        autoCapitalize="words"
                        placeholder="Acme Property Management"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Parent Account</Label>
                      <CustomerSearch
                        name="parentCustomerId"
                        defaultValue={parentCustomerId ?? undefined}
                        defaultLabel={parentCustomerLabel}
                        onChange={(val) => setParentCustomerId(val)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="accountNo">Account Number</Label>
                      <Input
                        id="accountNo"
                        value={customer.accountNo}
                        disabled
                        className="bg-muted tabular-nums"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="assignedAgent">Assigned Agent</Label>
                      <Input
                        id="assignedAgent"
                        value={assignedAgentId}
                        onChange={(e) => setAssignedAgentId(e.target.value)}
                        placeholder="Agent name or ID"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="vip"
                          checked={vip}
                          onCheckedChange={(c) => setVip(c === true)}
                        />
                        <Label htmlFor="vip" className="cursor-pointer">
                          VIP Account
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="active"
                          checked={active}
                          onCheckedChange={(c) => setActive(c === true)}
                        />
                        <Label htmlFor="active" className="cursor-pointer">
                          Active
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="taxable"
                          checked={taxable}
                          onCheckedChange={(c) => setTaxable(c === true)}
                        />
                        <Label htmlFor="taxable" className="cursor-pointer">
                          Taxable
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Tags</Label>
                      <TagSelect
                        name="tagIds"
                        availableTags={availableTags}
                        defaultSelected={availableTags.filter((t) =>
                          tagIds.includes(t.id),
                        )}
                        onChange={(selected) =>
                          setTagIds(selected.map((s) => s.id))
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Referral Source</Label>
                      <ReferralSelect
                        name="referralSourceId"
                        options={referralOptions}
                        defaultValue={referralSourceId ?? undefined}
                        onChange={(val) => setReferralSourceId(val)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contacts */}
              {contactsState.map((contact, ci) => (
                <Card key={contact.id || `new-${ci}`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold">
                        {contact.id ? `Contact ${ci + 1}` : 'New Contact'}
                      </CardTitle>
                      {contact.id && primaryContactId === contact.id && (
                        <Badge className="gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                          <Star className="size-3 fill-amber-500 text-amber-500" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {contact.id && primaryContactId !== contact.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs"
                          onClick={() =>
                            startTransition(async () => {
                              const result = await setPrimaryContactAction(customer.id, contact.id)
                              if (result.success) {
                                setPrimaryContactId(contact.id)
                              }
                            })
                          }
                        >
                          <Star className="size-3" />
                          Set Primary
                        </Button>
                      )}
                      {(!contact.id || contactsState.length > 1) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => removeContact(ci)}
                        >
                          <Trash2 className="size-3" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`contact-first-${ci}`}>First name *</Label>
                        <Input
                          id={`contact-first-${ci}`}
                          value={contact.firstName}
                          onChange={(e) =>
                            updateContact(ci, 'firstName', e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))
                          }
                          autoCapitalize="words"
                          placeholder="First name"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`contact-last-${ci}`}>Last name</Label>
                        <Input
                          id={`contact-last-${ci}`}
                          value={contact.lastName}
                          onChange={(e) =>
                            updateContact(ci, 'lastName', e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))
                          }
                          autoCapitalize="words"
                          placeholder="Last name"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`contact-job-${ci}`}>Job Title</Label>
                        <Input
                          id={`contact-job-${ci}`}
                          value={contact.jobTitle}
                          onChange={(e) =>
                            updateContact(ci, 'jobTitle', e.target.value)
                          }
                          placeholder="e.g. Property Manager"
                        />
                      </div>

                      {/* Phones */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Phone Numbers</Label>
                        <div className="space-y-2">
                          {contact.phones.map((phone, pi) => (
                            <div key={pi} className="flex items-center gap-2">
                              <Phone className="size-4 text-muted-foreground" />
                              <Input
                                placeholder="555-0100"
                                value={formatPhone(phone.number)}
                                onChange={(e) =>
                                  updateContactPhone(
                                    ci,
                                    pi,
                                    'number',
                                    e.target.value.replace(/\D/g, ''),
                                  )
                                }
                                className="max-w-[200px]"
                              />
                              <Select
                                value={phone.type}
                                onValueChange={(val) =>
                                  updateContactPhone(
                                    ci,
                                    pi,
                                    'type',
                                    val ?? '',
                                  )
                                }
                              >
                                <SelectTrigger className="h-9 w-[100px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cell">Cell</SelectItem>
                                  <SelectItem value="home">Home</SelectItem>
                                  <SelectItem value="work">Work</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  id={`phone-primary-${ci}-${pi}`}
                                  checked={phone.isPrimary}
                                  onCheckedChange={(c) =>
                                    updateContactPhone(
                                      ci,
                                      pi,
                                      'isPrimary',
                                      c === true,
                                    )
                                  }
                                />
                                <Label
                                  htmlFor={`phone-primary-${ci}-${pi}`}
                                  className="cursor-pointer text-xs"
                                >
                                  Primary
                                </Label>
                              </div>
                              {contact.phones.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-destructive"
                                  onClick={() => removeContactPhone(ci, pi)}
                                >
                                  <X className="size-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addContactPhone(ci)}
                          >
                            <Plus className="mr-1 size-3" />
                            Add phone
                          </Button>
                        </div>
                      </div>

                      {/* Emails */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Email Addresses</Label>
                        <div className="space-y-2">
                          {contact.emails.map((email, ei) => (
                            <div key={ei} className="flex items-center gap-2">
                              <Mail className="size-4 text-muted-foreground" />
                              <Input
                                type="email"
                                placeholder="name@company.com"
                                value={email.address}
                                onChange={(e) =>
                                  updateContactEmail(
                                    ci,
                                    ei,
                                    'address',
                                    e.target.value,
                                  )
                                }
                                className="max-w-[280px]"
                              />
                              <Select
                                value={email.type}
                                onValueChange={(val) =>
                                  updateContactEmail(
                                    ci,
                                    ei,
                                    'type',
                                    val ?? '',
                                  )
                                }
                              >
                                <SelectTrigger className="h-9 w-[100px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="work">Work</SelectItem>
                                  <SelectItem value="personal">Personal</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  id={`email-primary-${ci}-${ei}`}
                                  checked={email.isPrimary}
                                  onCheckedChange={(c) =>
                                    updateContactEmail(
                                      ci,
                                      ei,
                                      'isPrimary',
                                      c === true,
                                    )
                                  }
                                />
                                <Label
                                  htmlFor={`email-primary-${ci}-${ei}`}
                                  className="cursor-pointer text-xs"
                                >
                                  Primary
                                </Label>
                              </div>
                              {contact.emails.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-destructive"
                                  onClick={() => removeContactEmail(ci, ei)}
                                >
                                  <X className="size-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addContactEmail(ci)}
                          >
                            <Plus className="mr-1 size-3" />
                            Add email
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`billing-${ci}`}
                            checked={contact.billingContact}
                            onCheckedChange={(c) =>
                              updateContact(ci, 'billingContact', c === true)
                            }
                          />
                          <Label
                            htmlFor={`billing-${ci}`}
                            className="cursor-pointer"
                          >
                            Billing Contact
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`booking-${ci}`}
                            checked={contact.bookingContact}
                            onCheckedChange={(c) =>
                              updateContact(ci, 'bookingContact', c === true)
                            }
                          />
                          <Label
                            htmlFor={`booking-${ci}`}
                            className="cursor-pointer"
                          >
                            Booking Contact
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`sms-${ci}`}
                            checked={contact.smsConsent}
                            onCheckedChange={(c) =>
                              updateContact(ci, 'smsConsent', c === true)
                            }
                          />
                          <Label
                            htmlFor={`sms-${ci}`}
                            className="cursor-pointer"
                          >
                            SMS Consent
                          </Label>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`birthday-${ci}`}>Birthday</Label>
                        <Input
                          id={`birthday-${ci}`}
                          type="date"
                          value={contact.birthday}
                          onChange={(e) =>
                            updateContact(ci, 'birthday', e.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`anniversary-${ci}`}>Anniversary</Label>
                        <Input
                          id={`anniversary-${ci}`}
                          type="date"
                          value={contact.anniversary}
                          onChange={(e) =>
                            updateContact(ci, 'anniversary', e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={addContact}
                className="gap-1"
              >
                <Plus className="size-4" />
                Add Contact
              </Button>

              {/* Locations */}
              <LocationsSection
                customerId={customer.id}
                locations={locations}
                primaryLocationId={primaryLocationId}
              />

              {/* Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="internalNotes">Internal Notes</Label>
                      <Textarea
                        id="internalNotes"
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        placeholder="Office-only notes…"
                        rows={4}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="publicNotes">
                        Public / Work-Order Notes
                      </Label>
                      <Textarea
                        id="publicNotes"
                        value={publicNotes}
                        onChange={(e) => setPublicNotes(e.target.value)}
                        placeholder="Notes that appear on jobs…"
                        rows={4}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activity sidebar */}
            <aside className="space-y-4 lg:h-[calc(100vh-14rem)] lg:sticky lg:top-4">
              <ActivitySidebar
                events={events}
                customerId={customer.id}
              />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Jobs</h3>
              <Link
                href={`/jobs/new?customerId=${customer.id}&contactId=${initialContacts[0]?.id ?? ''}&locationId=${primaryLocationId ?? locations[0]?.id ?? ''}`}
              >
                <Button size="sm" variant="outline">New Job</Button>
              </Link>
            </div>
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Job #</th>
                      <th className="px-4 py-2 text-left font-semibold">Description</th>
                      <th className="px-4 py-2 text-left font-semibold">Status</th>
                      <th className="px-4 py-2 text-left font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-muted/50">
                        <td className="px-4 py-2">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="font-medium hover:underline"
                          >
                            #{job.jobNo}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {job.description ?? '—'}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            {job.status
                              .split('_')
                              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                              .join(' ')}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {job.startDate
                            ? new Date(job.startDate).toLocaleDateString(undefined, { timeZone: 'UTC' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="financial">
          <Placeholder
            title="Financial Data"
            message="Financial overview, billing history, and payment methods will appear here in a future release."
          />
        </TabsContent>

        <TabsContent value="locations">
          <Placeholder
            title="Service Locations"
            message="A dedicated map and location management view is planned for a future release."
          />
        </TabsContent>

        <TabsContent value="equipment">
          <Placeholder
            title="Equipment"
            message="Equipment dashboard and maintenance schedules are planned for a future release."
          />
        </TabsContent>

        <TabsContent value="documents">
          <Placeholder
            title="Documents"
            message="Document storage and management will be available in a future release."
          />
        </TabsContent>

        <TabsContent value="history">
          <Placeholder
            title="History"
            message="Complete interaction history will be available in a future release."
          />
        </TabsContent>

        <TabsContent value="logs">
          <Placeholder
            title="Logs"
            message="Audit logs and system activity will be available in a future release."
          />
        </TabsContent>
      </Tabs>

      {/* Deactivate Dialog */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Deactivate this customer?
            </DialogTitle>
            <DialogDescription>
              They&apos;ll be hidden from the active list but their records are
              kept. You can reactivate them later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeactivateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Placeholder({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
