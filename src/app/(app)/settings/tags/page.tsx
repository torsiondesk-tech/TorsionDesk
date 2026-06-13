import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listTagsWithUsage } from '@/lib/settings'
import { TagRow } from './tag-row'

/**
 * Tags settings page (SET-02, D-08).
 *
 * Server component: reads all tags with usage counts for the active tenant,
 * then renders the client list with add/edit/delete dialogs.
 */
export default async function TagsPage() {
  const { orgId } = await auth()
  if (!orgId) {
    redirect('/sign-in')
  }

  const tags = await listTagsWithUsage(orgId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold leading-tight">Tags</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage custom tags for jobs and estimates. Tags you create here
          appear when tagging customers, jobs, and estimates.
        </p>
      </div>

      <TagRow initialTags={tags} />
    </div>
  )
}
