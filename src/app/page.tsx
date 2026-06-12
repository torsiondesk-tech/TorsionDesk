import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

/**
 * Root redirect — send signed-in users to the dashboard, everyone else to sign-in.
 */
export default async function Home() {
  const { userId } = await auth()
  if (userId) {
    redirect('/dashboard')
  }
  redirect('/sign-in')
}
