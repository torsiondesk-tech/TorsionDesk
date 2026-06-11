import { SignIn } from '@clerk/nextjs'

/**
 * Custom-route sign-in page (AUTH-03/04/05, D-04).
 *
 * Renders Clerk's <SignIn/> on the product's own domain (not Clerk's hosted UI).
 * The optional catch-all segment [[...sign-in]] lets Clerk own the sub-steps of
 * the flow (e.g. password reset, MFA) under /sign-in. Session persistence
 * (AUTH-04) and the password-reset email link (AUTH-05) are built into this
 * component — no extra code. This route is in the middleware public matcher.
 */
export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <SignIn />
    </main>
  )
}
