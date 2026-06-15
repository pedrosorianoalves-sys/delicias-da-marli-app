import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getRedirectPathForAccess,
  getUserAccessContext,
} from '@/lib/auth/permissions'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const accessContext = await getUserAccessContext()
  redirect(getRedirectPathForAccess(accessContext))
}
