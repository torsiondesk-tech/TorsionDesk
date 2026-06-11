import { CreateOrganization } from '@clerk/nextjs'

/**
 * Workspace creation page — for users who signed up but don't have an org yet.
 *
 * Renders Clerk's <CreateOrganization/> component. After the org is created,
 * Clerk fires the organization.created webhook (which provisions the tenant row
 * in Supabase), then redirects the user to /onboarding to fill company details.
 */
export default function CreateWorkspacePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <CreateOrganization
        afterCreateOrganizationUrl="/onboarding"
        skipInvitationScreen
      />
    </main>
  )
}
