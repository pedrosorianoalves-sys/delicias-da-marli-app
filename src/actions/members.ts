'use server'

import { revalidatePath } from 'next/cache'

import { requireCompanyRole } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type {
  ActionResponse,
  AvailableCustomerProfile,
  CompanyMemberWithProfile,
  MemberRole,
  ProfileAccountType,
} from '@/types'

const MANAGEABLE_ROLES: MemberRole[] = ['owner', 'admin', 'operator', 'customer']
const PROMOTABLE_ROLES: MemberRole[] = ['owner', 'admin', 'operator']

type CompanyMemberProfileRow = {
  member_id: string
  company_id: string
  user_id: string
  role: MemberRole
  member_created_at: string
  member_updated_at: string
  full_name: string | null
  email: string | null
  account_type: ProfileAccountType | null
}

export async function listCompanyMembers(): Promise<CompanyMemberWithProfile[]> {
  const context = await requireCompanyRole(['owner', 'admin'])
  if ('error' in context) return []

  const supabase = await createClient()
  const { data, error } = await supabase.rpc(
    'list_company_members_with_profiles',
    {
      target_company_id: context.companyId,
    },
  )

  if (error) {
    console.error('listCompanyMembers error:', error.message)
    return []
  }

  if (!Array.isArray(data)) return []

  return (data as CompanyMemberProfileRow[]).map((row) => ({
    id: row.member_id,
    company_id: row.company_id,
    user_id: row.user_id,
    role: row.role,
    created_at: row.member_created_at,
    updated_at: row.member_updated_at,
    profile:
      row.full_name || row.email || row.account_type
        ? {
            full_name: row.full_name ?? '',
            email: row.email,
            account_type: row.account_type,
          }
        : null,
  }))
}

export async function listCompanyMembersAndAvailableCustomers(): Promise<{
  members: CompanyMemberWithProfile[]
  availableCustomers: AvailableCustomerProfile[]
}> {
  const context = await requireCompanyRole(['owner', 'admin'])
  if ('error' in context) return { members: [], availableCustomers: [] }

  const members = await listCompanyMembers()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_unassigned_customer_profiles')

  if (error) {
    console.error('listCompanyMembersAndAvailableCustomers error:', error.message)
    return { members, availableCustomers: [] }
  }

  return {
    members,
    availableCustomers: Array.isArray(data)
      ? (data as AvailableCustomerProfile[])
      : [],
  }
}

export async function updateCompanyMemberRole(
  memberId: string,
  role: MemberRole,
): Promise<ActionResponse> {
  const context = await requireCompanyRole(['owner'])
  if ('error' in context) return { success: false, error: context.error }

  if (!MANAGEABLE_ROLES.includes(role)) {
    return { success: false, error: 'Role inválido.' }
  }

  const supabase = await createClient()
  const { data: member } = await supabase
    .from('company_members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('company_id', context.companyId)
    .single<{ id: string; user_id: string; role: MemberRole }>()

  if (!member) return { success: false, error: 'Membro não encontrado.' }

  if (member.role === 'owner' && role !== 'owner') {
    const { count, error: countError } = await supabase
      .from('company_members')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', context.companyId)
      .eq('role', 'owner')

    if (countError) {
      console.error('updateCompanyMemberRole owner count error:', countError.message)
      return { success: false, error: 'Erro ao validar owners da empresa.' }
    }

    if ((count ?? 0) <= 1) {
      return {
        success: false,
        error: 'Não é possível remover o último owner da empresa.',
      }
    }
  }

  if (member.user_id === context.userId && member.role === 'owner' && role !== 'owner') {
    return {
      success: false,
      error: 'Você não pode remover seu próprio acesso de owner.',
    }
  }

  const { error } = await supabase
    .from('company_members')
    .update({ role })
    .eq('id', memberId)
    .eq('company_id', context.companyId)

  if (error) {
    console.error('updateCompanyMemberRole error:', error.message)
    return { success: false, error: 'Erro ao alterar role do membro.' }
  }

  revalidatePath('/usuarios')
  return { success: true }
}

export async function promoteCustomerToCompany(
  userId: string,
  role: MemberRole,
): Promise<ActionResponse> {
  const context = await requireCompanyRole(['owner'])
  if ('error' in context) return { success: false, error: context.error }

  if (!PROMOTABLE_ROLES.includes(role)) {
    return {
      success: false,
      error: 'Escolha admin, operador ou owner para adicionar à equipe.',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('promote_customer_to_company', {
    target_user_id: userId,
    target_company_id: context.companyId,
    target_role: role,
  })

  if (error) {
    console.error('promoteCustomerToCompany error:', error.message)
    return {
      success: false,
      error: 'Não foi possível adicionar este cliente à equipe.',
    }
  }

  revalidatePath('/usuarios')
  return { success: true }
}

export async function updateMemberProfileName(
  userId: string,
  fullName: string,
): Promise<ActionResponse> {
  const context = await requireCompanyRole(['owner'])
  if ('error' in context) return { success: false, error: context.error }

  const safeName = fullName.trim()
  if (!safeName) return { success: false, error: 'Informe um nome válido.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_company_member_profile_name', {
    target_user_id: userId,
    target_company_id: context.companyId,
    target_full_name: safeName,
  })

  if (error) {
    console.error('updateMemberProfileName error:', error.message)
    return { success: false, error: 'Não foi possível atualizar o nome.' }
  }

  revalidatePath('/usuarios')
  return { success: true }
}
