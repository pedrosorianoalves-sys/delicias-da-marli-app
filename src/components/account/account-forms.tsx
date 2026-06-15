'use client'

import { useActionState } from 'react'
import { Loader2, LogOut, Save } from 'lucide-react'

import {
  changeOwnPassword,
  updateOwnProfile,
  type AccountActionState,
} from '@/actions/account'
import { signOut } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AccountFormsProps = {
  fullName: string
}

const initialState: AccountActionState = null

function ActionFeedback({ state }: { state: AccountActionState }) {
  if (!state?.error && !state?.success) return null

  return (
    <p
      className={
        state.error
          ? 'text-sm font-medium text-destructive'
          : 'text-sm font-medium text-emerald-700'
      }
    >
      {state.error ?? state.success}
    </p>
  )
}

export function AccountForms({ fullName }: AccountFormsProps) {
  const [profileState, profileAction, isSavingProfile] = useActionState(
    updateOwnProfile,
    initialState,
  )
  const [passwordState, passwordAction, isChangingPassword] = useActionState(
    changeOwnPassword,
    initialState,
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Dados do perfil</CardTitle>
          <CardDescription>
            Atualize apenas seu nome. Email e permissões são controlados pelo sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={fullName}
                required
                autoComplete="name"
              />
            </div>

            <ActionFeedback state={profileState} />

            <Button type="submit" disabled={isSavingProfile}>
              {isSavingProfile ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Salvar alterações
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Trocar senha</CardTitle>
            <CardDescription>
              Use pelo menos 8 caracteres para a nova senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={passwordAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current_password">Senha atual</Label>
                <Input
                  id="current_password"
                  name="current_password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_password">Nova senha</Label>
                <Input
                  id="new_password"
                  name="new_password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirmar nova senha</Label>
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>

              <ActionFeedback state={passwordState} />

              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  'Trocar senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessão</CardTitle>
            <CardDescription>Encerre o acesso neste dispositivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signOut}>
              <Button type="submit" variant="outline">
                <LogOut className="size-4" />
                Sair da conta
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
