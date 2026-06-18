'use server'

import { auth } from '@clerk/nextjs/server'
import { performGlobalSearch } from '@/lib/global-search'

export async function globalSearchAction(q: string) {
  const { orgId } = await auth()
  if (!orgId) return []
  return performGlobalSearch(orgId, q)
}
