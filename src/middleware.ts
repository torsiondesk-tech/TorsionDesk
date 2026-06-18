import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Security perimeter (AUTH-06, D-14/D-15/D-16; RESEARCH Pattern 2).
 *
 * `clerkMiddleware()` is DEFAULT-PUBLIC — every route must opt in to protection.
 * The file MUST live at `src/middleware.ts` (Next.js <=15 requires it at the
 * project/src root, not in a subfolder).
 *
 * Public routes (no session required):
 *   - /sign-in(.*)      — the custom Clerk sign-in page
 *   - /sign-up(.*)      — the PUBLIC workspace-creation entry (D-01/D-03): anyone
 *                         with the URL can sign up and create an org
 *   - /api/webhooks(.*) — Clerk org-provisioning webhook; MUST be public or
 *                         `organization.created` provisioning 401s (Pitfall 4)
 *
 * Everything else requires a Clerk session (`auth.protect()`). Then:
 *   - Technicians (`org:technician`) are redirected to /mobile-coming-soon before
 *     any web shell renders (D-14, threat T-00-07).
 *   - /settings(.*) additionally requires `org:admin` (D-15, threat T-00-06) —
 *     this is the SERVER-SIDE enforcement, not merely nav hiding (defense in
 *     depth; the sidebar hiding in Plan 03 is the UX-only second layer).
 */
const isPublic = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
])
const isSettings = createRouteMatcher(['/settings(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Public routes opt OUT of protection entirely.
  if (isPublic(req)) return

  // Require a signed-in session for every non-public route.
  await auth.protect()

  // Read the active org role from the verified session (the JWT `o.rol` claim).
  const { orgRole } = await auth()

  // D-14: technicians never see the web shell — bounce them to the holding page.
  // Use NextResponse.redirect so Clerk/Next.js can append headers; the native
  // Response.redirect() object has immutable headers and throws when mutated.
  if (orgRole === 'org:technician') {
    return NextResponse.redirect(new URL('/mobile-coming-soon', req.url))
  }

  // D-15: /settings is admin-only — server-side gate (not just nav hiding).
  if (isSettings(req)) {
    await auth.protect({ role: 'org:admin' })
  }
})

// Matcher excludes Next internals (_next) and static files (anything with a dot),
// but always runs on API/tRPC routes. (RESEARCH Pattern 2.)
export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
}
