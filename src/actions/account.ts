'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

export type AccountActionState = {
  success?: string
  error?: string
} | null

export async function updateOwnProfile(
  _prevState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const fullName = (formData.get('full_name') as string | null)?.trim() ?? ''

  if (!fullName) {
    return { error: 'Nome completo é obrigatório.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Usuário não autenticado.' }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', user.id)

  if (profileError) {
    console.error('updateOwnProfile profile error:', profileError.message)
    return { error: 'Erro ao atualizar nome.' }
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  })

  if (authError) {
    console.error('updateOwnProfile auth metadata error:', authError.message)
  }

  revalidatePath('/minha-conta')
  revalidatePath('/dashboard')
  return { success: 'Nome atualizado com sucesso.' }
}

export async function changeOwnPassword(
  _prevState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const currentPassword = (formData.get('current_password') as string | null) ?? ''
  const newPassword = (formData.get('new_password') as string | null) ?? ''
  const confirmPassword = (formData.get('confirm_password') as string | null) ?? ''

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Preencha todos os campos de senha.' }
  }

  if (newPassword.length < 8) {
    return { error: 'A nova senha deve ter pelo menos 8 caracteres.' }
  }

  if (newPassword !== confirmPassword) {
    return { error: 'A confirmação da nova senha não confere.' }
  }

  if (currentPassword === newPassword) {
    return { error: 'A nova senha precisa ser diferente da senha atual.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { error: 'Usuário não autenticado.' }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (signInError) {
    if (signInError.message.includes('Invalid login credentials')) {
      return { error: 'Senha atual incorreta.' }
    }

    console.error('changeOwnPassword verify error:', signInError.message)
    return { error: 'Erro ao validar senha atual.' }
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    console.error('changeOwnPassword update error:', error.message)
    return { error: 'Erro ao trocar senha. Tente novamente.' }
  }

  return { success: 'Senha alterada com sucesso.' }
}
