'use server'

import { createClient } from '@/lib/supabase/server'
import {
  getRedirectPathForAccess,
  getUserAccessContext,
} from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'

export type AuthActionState = {
  error: string
} | null

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email e senha são obrigatórios.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'Email ou senha incorretos.' }
    }
    return { error: 'Erro ao fazer login. Tente novamente.' }
  }

  const accessContext = await getUserAccessContext()
  redirect(getRedirectPathForAccess(accessContext))
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string

  if (!email || !password || !fullName) {
    return { error: 'Todos os campos são obrigatórios.' }
  }

  if (password.length < 6) {
    return { error: 'A senha deve ter pelo menos 6 caracteres.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'Este email já está cadastrado.' }
    }
    return { error: 'Erro ao criar conta. Tente novamente.' }
  }

  const accessContext = await getUserAccessContext()
  redirect(getRedirectPathForAccess(accessContext))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserCompany() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: member } = await supabase
    .from('company_members')
    .select('company_id, role, companies(id, name)')
    .eq('user_id', user.id)
    .single()

  if (!member) return null

  return {
    companyId: member.company_id,
    role: member.role,
    company: member.companies as unknown as { id: string; name: string },
  }
}
