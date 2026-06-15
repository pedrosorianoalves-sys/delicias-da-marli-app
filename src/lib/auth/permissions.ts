import { createClient } from '@/lib/supabase/server'
import type { MemberRole, ProfileAccountType } from '@/types'

export const ADMIN_ROLES: MemberRole[] = ['owner', 'admin', 'operator']
export const MANAGEMENT_ROLES: MemberRole[] = ['owner']

export interface UserCompanyRole {
  userId: string
  companyId: string
  role: MemberRole
}

export interface UserAccessContext {
  userId: string
  companyId: string | null
  role: MemberRole | null
  accountType: ProfileAccountType | null
}

export function isAdminRole(role: MemberRole | null | undefined) {
  return role ? ADMIN_ROLES.includes(role) : false
}

export function getRoleLabel(role: MemberRole | null | undefined) {
  const labels: Record<MemberRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    operator: 'Operador',
    customer: 'Cliente',
  }

  return role ? labels[role] : 'Sem acesso'
}

export function getRedirectPathForRole(role: MemberRole | null | undefined) {
  if (role === 'customer') return '/cliente'
  if (isAdminRole(role)) return '/dashboard'
  return '/cliente'
}

export function getRedirectPathForAccess(
  context: UserAccessContext | null,
) {
  if (!context) return '/login'
  if (isAdminRole(context.role)) return '/dashboard'
  if (context.role === 'customer' || context.accountType === 'customer') {
    return '/cliente'
  }
  return '/cliente'
}

export async function getUserAccessContext(): Promise<UserAccessContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const [{ data: member }, { data: profile }] = await Promise.all([
    supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .maybeSingle<{ company_id: string; role: MemberRole }>(),
    supabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .maybeSingle<{ account_type: ProfileAccountType | null }>(),
  ])

  return {
    userId: user.id,
    companyId: member?.company_id ?? null,
    role: member?.role ?? null,
    accountType: profile?.account_type ?? null,
  }
}

export async function getUserCompanyRole(): Promise<UserCompanyRole | null> {
  const context = await getUserAccessContext()

  if (!context?.companyId || !context.role) return null

  return {
    userId: context.userId,
    companyId: context.companyId,
    role: context.role,
  }
}

export async function requireCompanyRole(
  allowedRoles: MemberRole[] = ADMIN_ROLES,
): Promise<UserCompanyRole | { error: string }> {
  const context = await getUserCompanyRole()

  if (!context) return { error: 'Você não tem permissão para acessar esta área.' }
  if (!allowedRoles.includes(context.role)) {
    return { error: 'Você não tem permissão para acessar esta área.' }
  }

  return context
}
