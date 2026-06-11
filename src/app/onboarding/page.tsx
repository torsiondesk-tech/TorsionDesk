'use client'

import { useActionState } from 'react'
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
import { completeOnboarding, type OnboardingState } from './actions'

/**
 * Onboarding page (D-05/D-11) — a deliberately fast, two-field capture.
 *
 * Company name + phone is the onboarding minimum (~20 seconds, no 5-step wizard).
 * Submits to the `completeOnboarding` server action, which validates, persists
 * via `saveProfile`, and redirects to the dashboard. The full company profile
 * (address, email, logo) is editable later in Settings -> Company Profile.
 *
 * UI quality (global standard): shadcn primitives, consistent spacing scale,
 * clear typography hierarchy, CSS-variable colors for automatic dark/light, and
 * a subtle entrance animation (tw-animate-css).
 */
const initialState: OnboardingState = {}

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState)

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md animate-in fade-in-0 zoom-in-95 duration-500">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Welcome to TorsionDesk
          </CardTitle>
          <CardDescription>
            Just two quick details and you are ready to go.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                name="companyName"
                placeholder="Infantino's Garage Door Service"
                autoComplete="organization"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="(555) 123-4567"
                autoComplete="tel"
                required
              />
            </div>

            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Setting up…' : 'Get started'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
