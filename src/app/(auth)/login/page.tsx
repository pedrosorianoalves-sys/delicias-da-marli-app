'use client'

import { useActionState, useState } from 'react'
import { signIn, signUp } from '@/actions/auth'
import type { AuthActionState } from '@/actions/auth'
import { BrandLogo } from '@/components/brand/brand-logo'
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
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const [signInState, signInAction, isSignInPending] = useActionState<
    AuthActionState,
    FormData
  >(signIn, null)

  const [signUpState, signUpAction, isSignUpPending] = useActionState<
    AuthActionState,
    FormData
  >(signUp, null)

  const isPending = isSignInPending || isSignUpPending
  const error =
    mode === 'login' ? signInState?.error : signUpState?.error

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 px-4 py-12">
      {/* Decorative background elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-rose-200/30 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-48 w-48 -translate-x-1/2 rounded-full bg-pink-200/20 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-xl shadow-rose-200/20 border-rose-100/50">
        <CardHeader className="space-y-2 text-center">
          <BrandLogo
            className="mx-auto flex-col gap-2"
            imageClassName="h-20 max-w-48"
            textClassName="text-2xl text-rose-900"
            showText={false}
            priority
          />
          <CardTitle className="sr-only">Delícias da Marli</CardTitle>
          <CardDescription className="text-base text-rose-600/70">
            Sistema de Gestão
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form
              action={signInAction}
              className="space-y-4"
              onSubmit={(event) => {
                if (isPending) event.preventDefault()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  disabled={isPending}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={isPending}
                  className="h-10"
                />
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="h-10 w-full bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500"
                size="lg"
              >
                {isSignInPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          ) : (
            <form
              action={signUpAction}
              className="space-y-4"
              onSubmit={(event) => {
                if (isPending) event.preventDefault()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="signup-name">Nome completo</Label>
                <Input
                  id="signup-name"
                  name="full_name"
                  type="text"
                  placeholder="Maria da Silva"
                  required
                  autoComplete="name"
                  disabled={isPending}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  disabled={isPending}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={isPending}
                  className="h-10"
                />
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="h-10 w-full bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500"
                size="lg"
              >
                {isSignUpPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  'Criar conta'
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <p>
                Não tem conta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="font-medium text-rose-600 underline-offset-4 transition-colors hover:text-rose-700 hover:underline"
                >
                  Cadastrar-se
                </button>
              </p>
            ) : (
              <p>
                Já tem conta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="font-medium text-rose-600 underline-offset-4 transition-colors hover:text-rose-700 hover:underline"
                >
                  Entrar
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
