'use server'

import { createClient } from '@/lib/supabase/server'
import { requireCompanyRole } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import type { ActionResponse, Customer } from '@/types'

async function getCompanyId(): Promise<
  { companyId: string; userId: string } | { error: string }
> {
  const result = await requireCompanyRole()
  if ('error' in result) return { error: result.error }
  return { companyId: result.companyId, userId: result.userId }
}

function revalidateCustomerPaths(id?: string) {
  revalidatePath('/clientes')
  if (id) revalidatePath(`/clientes/${id}`)
}

function parseCustomerForm(formData: FormData) {
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const phone = (formData.get('phone') as string | null)?.trim() || null
  const email = (formData.get('email') as string | null)?.trim() || null
  const address = (formData.get('address') as string | null)?.trim() || null
  const notes = (formData.get('notes') as string | null)?.trim() || null

  const errors: string[] = []

  if (!name) errors.push('Nome é obrigatório.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email inválido.')
  }

  if (errors.length > 0) {
    return { valid: false as const, error: errors.join(' ') }
  }

  return {
    valid: true as const,
    data: {
      name,
      phone,
      email,
      address,
      notes,
    },
  }
}

export async function getCustomers(): Promise<Customer[]> {
  const result = await getCompanyId()
  if ('error' in result) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('company_id', result.companyId)
    .order('name')

  if (error) {
    console.error('getCustomers error:', error.message)
    return []
  }

  return (data ?? []) as Customer[]
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const result = await getCompanyId()
  if ('error' in result) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('company_id', result.companyId)
    .single()

  if (error || !data) return null

  return data as Customer
}

export async function createCustomer(
  formData: FormData,
): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const parsed = parseCustomerForm(formData)
  if (!parsed.valid) {
    return { success: false, error: parsed.error }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('customers').insert({
    company_id: companyResult.companyId,
    ...parsed.data,
    total_spent: 0,
    total_orders: 0,
    last_order_at: null,
  })

  if (error) {
    console.error('createCustomer error:', error.message)
    return { success: false, error: 'Erro ao criar cliente.' }
  }

  revalidateCustomerPaths()
  return { success: true }
}

export async function updateCustomer(
  id: string,
  formData: FormData,
): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const parsed = parseCustomerForm(formData)
  if (!parsed.valid) {
    return { success: false, error: parsed.error }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('customers')
    .update(parsed.data)
    .eq('id', id)
    .eq('company_id', companyResult.companyId)

  if (error) {
    console.error('updateCustomer error:', error.message)
    return { success: false, error: 'Erro ao atualizar cliente.' }
  }

  revalidateCustomerPaths(id)
  return { success: true }
}

export async function deleteCustomer(id: string): Promise<ActionResponse> {
  const companyResult = await getCompanyId()
  if ('error' in companyResult) {
    return { success: false, error: companyResult.error }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('company_id', companyResult.companyId)

  if (error) {
    console.error('deleteCustomer error:', error.message)
    return { success: false, error: 'Erro ao excluir cliente.' }
  }

  revalidateCustomerPaths()
  return { success: true }
}
