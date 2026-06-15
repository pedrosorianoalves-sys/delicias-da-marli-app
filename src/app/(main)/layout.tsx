import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRoleLabel, isAdminRole } from '@/lib/auth/permissions'
import type { MemberRole } from '@/types'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile for display name
  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single(),
    supabase
      .from('company_members')
      .select('role')
      .eq('user_id', user.id)
      .single<{ role: MemberRole }>(),
  ])

  if (!member) {
    redirect('/sem-permissao')
  }

  if (!isAdminRole(member.role)) {
    redirect('/sem-permissao')
  }

  const sidebarUser = {
    full_name: profile?.full_name ?? user.user_metadata?.full_name ?? 'Usuário',
    email: profile?.email ?? user.email ?? '',
    role: member.role,
    role_label: getRoleLabel(member.role),
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:shrink-0">
        <Sidebar user={sidebarUser} />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <Header user={sidebarUser} />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
