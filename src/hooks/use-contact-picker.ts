'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { capitalizeWords, normalizePhone } from '@/lib/utils'
import {
  getCustomerContacts,
  getCustomerContactDetail,
  createContactForJob,
  type ContactDetail,
} from '@/app/(app)/jobs/actions'
import { setPrimaryContactAction } from '@/app/(app)/customers/actions'
import type { ContactEditorValue } from '@/components/contact-editor'
import { emptyContact } from '@/components/contact-editor'
import { logger } from '@/lib/logger'

export interface ContactEditState {
  id: string
  firstName: string
  lastName: string
  jobTitle: string
  phones: Array<{ id?: string; number: string; ext: string; type: string; isPrimary: boolean }>
  emails: Array<{ id?: string; address: string; type: string; isPrimary: boolean }>
  smsConsent: boolean
  billingContact: boolean
  bookingContact: boolean
}

export interface CustomerContactSummary {
  id: string
  firstName: string
  lastName: string | null
  phone: string | null
}

export interface ContactFormFields {
  contactId: string
  contactUpdate: string
}

export interface ContactPayloadFields {
  contactId: string | null
  contactUpdate: string
}

export function emptyContactEdit(): ContactEditState {
  return {
    id: '',
    firstName: '',
    lastName: '',
    jobTitle: '',
    phones: [{ number: '', ext: '', type: 'cell', isPrimary: true }],
    emails: [{ address: '', type: 'work', isPrimary: true }],
    smsConsent: true,
    billingContact: false,
    bookingContact: false,
  }
}

function contactDetailToEditState(detail: ContactDetail): ContactEditState {
  return {
    id: detail.id,
    firstName: detail.firstName,
    lastName: detail.lastName ?? '',
    jobTitle: detail.jobTitle ?? '',
    phones:
      detail.phones.length > 0
        ? detail.phones.map((p) => ({
            id: p.id,
            number: p.number,
            ext: p.ext ?? '',
            type: p.type,
            isPrimary: p.isPrimary ?? false,
          }))
        : [{ number: '', ext: '', type: 'cell', isPrimary: true }],
    emails:
      detail.emails.length > 0
        ? detail.emails.map((e) => ({
            id: e.id,
            address: e.address,
            type: e.type,
            isPrimary: e.isPrimary ?? false,
          }))
        : [{ address: '', type: 'work', isPrimary: true }],
    smsConsent: detail.smsConsent ?? false,
    billingContact: detail.billingContact ?? false,
    bookingContact: detail.bookingContact ?? false,
  }
}

export interface UseContactPickerResult {
  contactId: string | undefined
  contacts: CustomerContactSummary[]
  primaryContactId: string | null
  contactEdit: ContactEditState | null

  contactPickerOpen: boolean
  contactPickerSelected: string
  newContactDialogOpen: boolean
  dialogNewContact: ContactEditorValue
  dialogBirthday: string
  dialogAnniversary: string
  savingNewContactDialog: boolean
  newContactDialogError: string | null

  setContactId: (id: string | undefined) => void
  /** Push fetched contacts into the hook after a customer-change fetch */
  hydrate: (contacts: CustomerContactSummary[], primaryContactId: string | null) => void
  resetForCustomerChange: () => void

  openPicker: (currentContactId: string | undefined) => void
  closePicker: () => void
  setContactPickerSelected: (id: string) => void
  confirmPickerSelection: () => void

  openNewContactDialog: (hasNoContacts: boolean) => void
  closeNewContactDialog: () => void
  setDialogNewContact: (v: ContactEditorValue) => void
  setDialogBirthday: (v: string) => void
  setDialogAnniversary: (v: string) => void
  saveNewContactDialog: () => Promise<void>

  updateContactField: (
    field: keyof Omit<ContactEditState, 'phones' | 'emails'>,
    value: unknown,
  ) => void
  updateContactPhone: (
    pi: number,
    field: 'number' | 'ext' | 'type' | 'isPrimary',
    value: string | boolean,
  ) => void
  addContactPhone: () => void
  removeContactPhone: (pi: number) => void
  updateContactEmail: (
    ei: number,
    field: 'address' | 'type' | 'isPrimary',
    value: string | boolean,
  ) => void
  addContactEmail: () => void
  removeContactEmail: (ei: number) => void

  setPrimary: (contactId: string) => Promise<void>

  /** Serialize state as hidden-input name→value pairs for job-form's native <form action> */
  toFormFields: () => ContactFormFields
  /** Serialize state as JSON-payload fields for estimate-form's buildPayload() */
  toPayloadFields: () => ContactPayloadFields
}

export function useContactPicker(opts: {
  customerId: string | null | undefined
  contactMode: 'existing' | 'new'
  initialContact?: ContactEditState | null
  initialPrimaryContactId?: string | null
}): UseContactPickerResult {
  const customerIdRef = useRef(opts.customerId)
  customerIdRef.current = opts.customerId

  const contactModeRef = useRef(opts.contactMode)
  contactModeRef.current = opts.contactMode

  const [contactId, setContactId] = useState<string | undefined>(undefined)
  const [contacts, setContacts] = useState<CustomerContactSummary[]>([])
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(
    opts.initialPrimaryContactId ?? null,
  )
  const [contactEdit, setContactEdit] = useState<ContactEditState | null>(
    opts.initialContact ?? null,
  )

  const [contactPickerOpen, setContactPickerOpen] = useState(false)
  const [contactPickerSelected, setContactPickerSelected] = useState<string>('')
  const [newContactDialogOpen, setNewContactDialogOpen] = useState(false)
  const [dialogNewContact, setDialogNewContact] = useState<ContactEditorValue>(emptyContact())
  const [dialogBirthday, setDialogBirthday] = useState('')
  const [dialogAnniversary, setDialogAnniversary] = useState('')
  const [savingNewContactDialog, setSavingNewContactDialog] = useState(false)
  const [newContactDialogError, setNewContactDialogError] = useState<string | null>(null)

  // Fetch full contact detail when contactId changes
  useEffect(() => {
    if (!contactId || contactModeRef.current === 'new') return
    let cancelled = false
    getCustomerContactDetail(contactId)
      .then((detail) => {
        if (!cancelled && detail) {
          setContactEdit(contactDetailToEditState(detail))
        }
      })
      .catch((err) => logger.error('loadContactDetail', err))
    return () => {
      cancelled = true
    }
  }, [contactId])

  const hydrate = useCallback(
    (c: CustomerContactSummary[], pcId: string | null) => {
      setContacts(c)
      setPrimaryContactId(pcId)
    },
    [],
  )

  const resetForCustomerChange = useCallback(() => {
    setContactId(undefined)
    setContacts([])
    setPrimaryContactId(null)
    setContactEdit(null)
    setContactPickerOpen(false)
    setContactPickerSelected('')
    setNewContactDialogOpen(false)
    setNewContactDialogError(null)
  }, [])

  const openPicker = useCallback((currentId: string | undefined) => {
    setContactPickerSelected(currentId ?? '')
    setContactPickerOpen(true)
  }, [])

  const closePicker = useCallback(() => {
    setContactPickerOpen(false)
  }, [])

  const confirmPickerSelection = useCallback(() => {
    if (contactPickerSelected) setContactId(contactPickerSelected)
    setContactPickerOpen(false)
  }, [contactPickerSelected])

  const openNewContactDialog = useCallback((hasNoContacts: boolean) => {
    setContactPickerOpen(false)
    setDialogNewContact({ ...emptyContact(), billingContact: hasNoContacts })
    setDialogBirthday('')
    setDialogAnniversary('')
    setNewContactDialogError(null)
    setNewContactDialogOpen(true)
  }, [])

  const closeNewContactDialog = useCallback(() => {
    setNewContactDialogOpen(false)
  }, [])

  const saveNewContactDialog = useCallback(async () => {
    const customerId = customerIdRef.current
    if (!customerId) return
    if (!dialogNewContact.firstName.trim() && !dialogNewContact.lastName.trim()) {
      setNewContactDialogError('First or last name is required.')
      return
    }
    setSavingNewContactDialog(true)
    setNewContactDialogError(null)
    try {
      const result = await createContactForJob(customerId, {
        firstName: dialogNewContact.firstName.trim(),
        lastName: dialogNewContact.lastName.trim() || null,
        jobTitle: dialogNewContact.jobTitle.trim() || null,
        billingContact: dialogNewContact.billingContact,
        bookingContact: dialogNewContact.bookingContact,
        smsConsent: dialogNewContact.smsConsent,
        birthday: dialogBirthday || null,
        anniversary: dialogAnniversary || null,
        phones: dialogNewContact.phones
          .filter((p) => p.number.trim())
          .map((p) => ({ number: p.number, ext: p.ext || null, type: p.type, isPrimary: p.isPrimary })),
        emails: dialogNewContact.emails
          .filter((e) => e.address.trim())
          .map((e) => ({ address: e.address, type: e.type, isPrimary: e.isPrimary })),
      })
      if (result.error) {
        setNewContactDialogError(result.error)
        return
      }
      const { contacts: refreshed, primaryContactId: refreshedPrimary } =
        await getCustomerContacts(customerId)
      hydrate(refreshed, refreshedPrimary)
      setContactId(result.id)
      setNewContactDialogOpen(false)
    } catch (err) {
      setNewContactDialogError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingNewContactDialog(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogNewContact, dialogBirthday, dialogAnniversary, hydrate])

  const updateContactField = useCallback(
    (field: keyof Omit<ContactEditState, 'phones' | 'emails'>, value: unknown) => {
      let normalized = value
      if ((field === 'firstName' || field === 'lastName') && typeof value === 'string') {
        normalized = capitalizeWords(value)
      }
      setContactEdit((prev) => (prev ? { ...prev, [field]: normalized } : prev))
    },
    [],
  )

  const updateContactPhone = useCallback(
    (pi: number, field: 'number' | 'ext' | 'type' | 'isPrimary', value: string | boolean) => {
      setContactEdit((prev) => {
        if (!prev) return prev
        const phones = [...prev.phones]
        phones[pi] = { ...phones[pi], [field]: value }
        return { ...prev, phones }
      })
    },
    [],
  )

  const addContactPhone = useCallback(() => {
    setContactEdit((prev) => {
      if (!prev) return prev
      return { ...prev, phones: [...prev.phones, { number: '', ext: '', type: 'cell', isPrimary: false }] }
    })
  }, [])

  const removeContactPhone = useCallback((pi: number) => {
    setContactEdit((prev) => {
      if (!prev) return prev
      return { ...prev, phones: prev.phones.filter((_, i) => i !== pi) }
    })
  }, [])

  const updateContactEmail = useCallback(
    (ei: number, field: 'address' | 'type' | 'isPrimary', value: string | boolean) => {
      setContactEdit((prev) => {
        if (!prev) return prev
        const emails = [...prev.emails]
        emails[ei] = { ...emails[ei], [field]: value }
        return { ...prev, emails }
      })
    },
    [],
  )

  const addContactEmail = useCallback(() => {
    setContactEdit((prev) => {
      if (!prev) return prev
      return { ...prev, emails: [...prev.emails, { address: '', type: 'work', isPrimary: false }] }
    })
  }, [])

  const removeContactEmail = useCallback((ei: number) => {
    setContactEdit((prev) => {
      if (!prev) return prev
      return { ...prev, emails: prev.emails.filter((_, i) => i !== ei) }
    })
  }, [])

  const setPrimary = useCallback(async (cId: string) => {
    const customerId = customerIdRef.current
    if (!customerId) return
    const result = await setPrimaryContactAction(customerId, cId)
    if (result.success) setPrimaryContactId(cId)
  }, [])

  const toFormFields = useCallback((): ContactFormFields => ({
    contactId: contactId ?? '',
    contactUpdate: contactEdit ? JSON.stringify(contactEdit) : '',
  }), [contactId, contactEdit])

  const toPayloadFields = useCallback((): ContactPayloadFields => ({
    contactId: contactId ?? null,
    contactUpdate:
      contactId && contactEdit
        ? JSON.stringify({
            id: contactEdit.id,
            firstName: contactEdit.firstName,
            lastName: contactEdit.lastName,
            jobTitle: contactEdit.jobTitle,
            phones: contactEdit.phones
              .map((p) => ({ ...p, number: normalizePhone(p.number) }))
              .filter((p) => p.number),
            emails: contactEdit.emails.filter((e) => e.address.trim()),
            smsConsent: contactEdit.smsConsent,
            billingContact: contactEdit.billingContact,
            bookingContact: contactEdit.bookingContact,
          })
        : '',
  }), [contactId, contactEdit])

  return {
    contactId,
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

    setContactId,
    hydrate,
    resetForCustomerChange,
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
    toFormFields,
    toPayloadFields,
  }
}
