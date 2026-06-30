'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, X, Phone, Mail, Trash2, Star } from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import { ContactEditor } from '@/components/contact-editor'
import type { UseContactPickerResult } from '@/hooks/use-contact-picker'

export interface ContactPickerFieldsProps {
  picker: UseContactPickerResult
  customerId: string | null | undefined
  /** Prefix applied to all htmlFor/id values to prevent collisions between job-form and estimate-form instances */
  idPrefix?: string
}

export function ContactPickerFields({
  picker,
  customerId,
  idPrefix = 'cp',
}: ContactPickerFieldsProps) {
  const {
    contactId,
    setContactId,
    contacts,
    primaryContactId,
    contactEdit,
    contactPickerOpen,
    contactPickerSelected,
    newContactDialogOpen,
    dialogNewContact,
    dialogBirthday,
    dialogAnniversary,
    savingNewContactDialog,
    newContactDialogError,
    openPicker,
    closePicker,
    setContactPickerSelected,
    confirmPickerSelection,
    openNewContactDialog,
    closeNewContactDialog,
    setDialogNewContact,
    setDialogBirthday,
    setDialogAnniversary,
    saveNewContactDialog,
    updateContactField,
    updateContactPhone,
    addContactPhone,
    removeContactPhone,
    updateContactEmail,
    addContactEmail,
    removeContactEmail,
    setPrimary,
  } = picker

  if (!customerId) {
    return (
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled className="opacity-50">
          Select Contact
        </Button>
        <span className="text-xs text-muted-foreground">Select a customer first</span>
      </div>
    )
  }

  return (
    <>
      {/* Select Contact button + selected contact name */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openPicker(contactId)}
        >
          Select Contact
        </Button>
        {contactId && (
          <span className="text-sm font-medium">
            {contactEdit
              ? contactEdit.firstName + (contactEdit.lastName ? ' ' + contactEdit.lastName : '')
              : (() => {
                  const c = contacts.find((c) => c.id === contactId)
                  return c ? c.firstName + (c.lastName ? ' ' + c.lastName : '') : ''
                })()}
          </span>
        )}
      </div>

      {/* Contact picker dialog */}
      <Dialog open={contactPickerOpen} onOpenChange={(open) => { if (!open) closePicker() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Contact</DialogTitle>
            <DialogDescription>Choose a contact for this job or add a new one.</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto">
            {contacts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No contacts for this customer.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="w-8 py-2" />
                    <th className="py-2 text-left font-semibold">Contact Name</th>
                    <th className="py-2 text-left font-semibold">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => {
                    const label = c.firstName + (c.lastName ? ' ' + c.lastName : '')
                    return (
                      <tr
                        key={c.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setContactPickerSelected(c.id)}
                      >
                        <td className="py-2 pr-2">
                          <input
                            type="radio"
                            name={`${idPrefix}-contactPickerRadio`}
                            checked={contactPickerSelected === c.id}
                            onChange={() => setContactPickerSelected(c.id)}
                            className="accent-primary"
                          />
                        </td>
                        <td className="py-2 pr-4 font-medium text-amber-700">
                          {label}{c.id === primaryContactId ? ' (Primary)' : ''}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {c.phone ? formatPhone(c.phone) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => openNewContactDialog(contacts.length === 0)}
              className="mr-auto"
            >
              Add New Contact
            </Button>
            <Button type="button" variant="ghost" onClick={closePicker}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmPickerSelection}>
              Select
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Contact dialog */}
      <Dialog open={newContactDialogOpen} onOpenChange={(open) => { if (!open) closeNewContactDialog() }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>Create a new contact for this customer.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto space-y-5 pr-2">
            <ContactEditor
              value={dialogNewContact}
              onChange={setDialogNewContact}
              idPrefix={`${idPrefix}-dialog-nc`}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`${idPrefix}-dialog-birthday`} className="text-xs">Birthday</Label>
                <Input
                  id={`${idPrefix}-dialog-birthday`}
                  type="date"
                  value={dialogBirthday}
                  onChange={(e) => setDialogBirthday(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${idPrefix}-dialog-anniversary`} className="text-xs">Anniversary</Label>
                <Input
                  id={`${idPrefix}-dialog-anniversary`}
                  type="date"
                  value={dialogAnniversary}
                  onChange={(e) => setDialogAnniversary(e.target.value)}
                />
              </div>
            </div>
            {newContactDialogError && (
              <p className="text-sm text-destructive">{newContactDialogError}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeNewContactDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={saveNewContactDialog} disabled={savingNewContactDialog}>
              {savingNewContactDialog ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Primary contact badge / toggle */}
      {contactId && customerId && (
        <div className="flex items-center gap-2 pt-0.5">
          {contactId === primaryContactId ? (
            <Badge className="gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
              <Star className="size-3 fill-amber-500 text-amber-500" />
              Primary Contact
            </Badge>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={() => setPrimary(contactId)}
            >
              <Star className="size-3" />
              Set as Primary
            </Button>
          )}
        </div>
      )}

      {/* Full inline contact editor when an existing contact is selected */}
      {contactEdit && contactId && (
        <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-contact-firstName`} className="text-xs">First Name</Label>
              <Input
                id={`${idPrefix}-contact-firstName`}
                value={contactEdit.firstName}
                onChange={(e) => updateContactField('firstName', e.target.value)}
                autoCapitalize="words"
                placeholder="First name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-contact-lastName`} className="text-xs">Last Name</Label>
              <Input
                id={`${idPrefix}-contact-lastName`}
                value={contactEdit.lastName}
                onChange={(e) => updateContactField('lastName', e.target.value)}
                autoCapitalize="words"
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-contact-jobTitle`} className="text-xs">Job Title</Label>
            <Input
              id={`${idPrefix}-contact-jobTitle`}
              value={contactEdit.jobTitle}
              onChange={(e) => updateContactField('jobTitle', e.target.value)}
              placeholder="e.g. Property Manager"
            />
          </div>

          {/* Phones */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Phone Numbers
            </div>
            {contactEdit.phones.map((phone, pi) => (
              <div key={pi} className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                <Input
                  aria-label={`Phone number ${pi + 1}`}
                  placeholder="555-0100"
                  value={formatPhone(phone.number)}
                  onChange={(e) => updateContactPhone(pi, 'number', e.target.value.replace(/\D/g, ''))}
                  className="max-w-[160px]"
                />
                <Input
                  aria-label={`Phone ${pi + 1} extension`}
                  placeholder="Ext"
                  value={phone.ext}
                  onChange={(e) => updateContactPhone(pi, 'ext', e.target.value.replace(/\D/g, ''))}
                  className="w-16"
                />
                <Select
                  value={phone.type}
                  onValueChange={(val) => updateContactPhone(pi, 'type', val ?? '')}
                >
                  <SelectTrigger className="h-9 w-[100px]" aria-label={`Phone ${pi + 1} type`}>
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
                    id={`${idPrefix}-phone-primary-${pi}`}
                    checked={phone.isPrimary}
                    onCheckedChange={(c) => updateContactPhone(pi, 'isPrimary', c === true)}
                  />
                  <Label htmlFor={`${idPrefix}-phone-primary-${pi}`} className="cursor-pointer text-xs">
                    Primary
                  </Label>
                </div>
                {contactEdit.phones.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive"
                    onClick={() => removeContactPhone(pi)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addContactPhone}>
              <Plus className="mr-1 size-3" />
              Add phone
            </Button>
          </div>

          {/* Emails */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Email Addresses
            </div>
            {contactEdit.emails.map((email, ei) => (
              <div key={ei} className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                <Input
                  aria-label={`Email address ${ei + 1}`}
                  type="email"
                  placeholder="name@company.com"
                  value={email.address}
                  onChange={(e) => updateContactEmail(ei, 'address', e.target.value)}
                  className="max-w-[240px]"
                />
                <Select
                  value={email.type}
                  onValueChange={(val) => updateContactEmail(ei, 'type', val ?? '')}
                >
                  <SelectTrigger className="h-9 w-[100px]" aria-label={`Email ${ei + 1} type`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="work">Work</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id={`${idPrefix}-email-primary-${ei}`}
                    checked={email.isPrimary}
                    onCheckedChange={(c) => updateContactEmail(ei, 'isPrimary', c === true)}
                  />
                  <Label htmlFor={`${idPrefix}-email-primary-${ei}`} className="cursor-pointer text-xs">
                    Primary
                  </Label>
                </div>
                {contactEdit.emails.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive"
                    onClick={() => removeContactEmail(ei)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addContactEmail}>
              <Plus className="mr-1 size-3" />
              Add email
            </Button>
          </div>

          {/* Flags */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${idPrefix}-billing-contact`}
                checked={contactEdit.billingContact}
                onCheckedChange={(c) => updateContactField('billingContact', c === true)}
              />
              <Label htmlFor={`${idPrefix}-billing-contact`} className="cursor-pointer text-sm">
                Billing Contact
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${idPrefix}-booking-contact`}
                checked={contactEdit.bookingContact}
                onCheckedChange={(c) => updateContactField('bookingContact', c === true)}
              />
              <Label htmlFor={`${idPrefix}-booking-contact`} className="cursor-pointer text-sm">
                Booking Contact
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${idPrefix}-sms-consent`}
                checked={contactEdit.smsConsent}
                onCheckedChange={(c) => updateContactField('smsConsent', c === true)}
              />
              <Label htmlFor={`${idPrefix}-sms-consent`} className="cursor-pointer text-sm">
                SMS Consent
              </Label>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
