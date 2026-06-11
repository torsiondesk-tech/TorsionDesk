import { SignUp } from '@clerk/nextjs'

/**
 * Public custom-route sign-up page — the front door to workspace creation
 * (AUTH-01, D-01/D-03/D-04).
 *
 * This route is in the middleware `isPublic` matcher, so ANYONE with the URL can
 * reach it and create a workspace. Clerk's org-creation step is part of the
 * sign-up flow (D-03): email/password -> verify email -> name your organization,
 * which fires the `organization.created` webhook that provisions the tenant row
 * (Plan 02) and makes the JWT `o` claim present (RESEARCH Pitfall 6). After
 * sign-up Clerk lands the user on /onboarding (configured via env redirect URL).
 *
 * Session persistence (AUTH-04) and password reset (AUTH-05) are built into the
 * Clerk components — no extra code.
 */
export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <SignUp />
    </main>
  )
}
