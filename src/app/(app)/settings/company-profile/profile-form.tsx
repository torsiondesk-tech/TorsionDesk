'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  saveCompanyProfile,
  uploadCompanyLogo,
  type ProfileActionState,
  type LogoActionState,
} from './actions'
import { formatPhone } from '@/lib/utils'

/**
 * Company Profile form (TENANT-02, D-11/D-12).
 *
 * Two independent forms in one tab:
 *  - the business-details form (name / address / phone / email) → saveCompanyProfile
 *  - the logo upload (file input + preview) → uploadCompanyLogo
 *
 * Each uses React 19 `useActionState`. The logo preview shows the freshly chosen
 * file immediately (an object URL) and, after a successful upload, confirms the
 * stored object path. UI follows the global quality standard (shadcn primitives,
 * consistent spacing, clear hierarchy, CSS-variable colors, entrance animation).
 */
type Initial = {
  companyName: string
  phone: string
  address: string
  email: string
  logoUrl: string
}

const profileInitial: ProfileActionState = {}
const logoInitial: LogoActionState = {}

export function CompanyProfileForm({ initial }: { initial: Initial }) {
  const [profileState, profileAction, profilePending] = useActionState(
    saveCompanyProfile,
    profileInitial,
  )
  const [logoState, logoAction, logoPending] = useActionState(
    uploadCompanyLogo,
    logoInitial,
  )

  // Local object-URL preview of the chosen file (always renderable, even though
  // the bucket is private). Falls back to nothing until a file is picked.
  const [preview, setPreview] = useState<string | null>(null)
  const storedPath = logoState.logoUrl || initial.logoUrl

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 duration-300">
      {/* Business details */}
      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <CardDescription>
            This appears on invoices, estimates, and email headers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="companyName">Company name</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  defaultValue={initial.companyName}
                  placeholder="Infantino's Garage Door Service"
                  autoComplete="organization"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  defaultValue={initial.address}
                  placeholder="123 Main St, Springfield"
                  autoComplete="street-address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={formatPhone(initial.phone)}
                  placeholder="(555) 123-4567"
                  autoComplete="tel"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={initial.email}
                  placeholder="contact@infantinosgaragedoor.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {profileState.error ? (
              <p role="alert" className="text-sm text-destructive">
                {profileState.error}
              </p>
            ) : null}
            {profileState.success ? (
              <p role="status" className="text-sm text-emerald-600">
                Profile saved.
              </p>
            ) : null}

            <Button type="submit" disabled={profilePending}>
              {profilePending ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Logo upload */}
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Upload a logo (PNG, JPG, SVG, or WebP). Stored privately and used on
            customer-facing documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={logoAction} className="space-y-5">
            <div className="flex items-center gap-5">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt="Logo preview"
                    className="size-full object-contain"
                  />
                ) : storedPath ? (
                  <span className="px-2 text-center text-[10px] text-muted-foreground">
                    Logo on file
                  </span>
                ) : (
                  <span className="px-2 text-center text-[10px] text-muted-foreground">
                    No logo
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="logo">Logo file</Label>
                <Input
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    setPreview(file ? URL.createObjectURL(file) : null)
                  }}
                />
                {storedPath ? (
                  <p className="truncate text-xs text-muted-foreground">
                    Stored: {storedPath}
                  </p>
                ) : null}
              </div>
            </div>

            {logoState.error ? (
              <p role="alert" className="text-sm text-destructive">
                {logoState.error}
              </p>
            ) : null}

            <Button type="submit" variant="outline" disabled={logoPending}>
              {logoPending ? 'Uploading…' : 'Upload logo'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
