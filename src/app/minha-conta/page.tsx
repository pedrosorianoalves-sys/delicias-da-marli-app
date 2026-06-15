import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { AccountForms } from '@/components/account/account-forms'
import { BrandLogo } from '@/components/brand/brand-logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDate } from '@/lib/constants'
import {
  getRedirectPathForAccess,
  getRoleLabel,
  getUserAccessContext,
} from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { MemberRole, ProfileAccountType } from '@/types'

type ProfileRow = {
  full_name: string | null
  email: string | null
  account_type: ProfileAccountType | null
  created_at: string
}

type MemberRow = {
  role: MemberRole
  company:
    | {
        name: string
      }
    | {
        name: string
      }[]
    | null
}

function getJoinedCompany(member: MemberRow | null) {
  if (!member?.company) return null
  if (Array.isArray(member.company)) return member.company[0] ?? null
  return member.company
}

export default async function MyAccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email, account_type, created_at')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>(),
    supabase
      .from('company_members')
      .select('role, company:companies(name)')
      .eq('user_id', user.id)
      .maybeSingle<MemberRow>(),
  ])

  const accessContext = await getUserAccessContext()
  const backHref = getRedirectPathForAccess(accessContext)
  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Usuário'
  const email = profile?.email ?? user.email ?? '-'
  const role = member?.role ?? (profile?.account_type === 'customer' ? 'customer' : null)
  const company = getJoinedCompany(member)

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo imageClassName="h-12 max-w-28" showText={false} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Minha Conta</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seus dados básicos e senha de acesso.
              </p>
            </div>
          </div>

          <Button variant="outline" render={<Link href={backHref} />}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações da conta</CardTitle>
            <CardDescription>Esses dados identificam seu acesso no sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <InfoItem label="Nome" value={fullName} />
              <InfoItem label="Email" value={email} />
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Role atual</p>
                <Badge className="mt-2" variant="secondary">
                  {role ? getRoleLabel(role) : 'Sem acesso'}
                </Badge>
              </div>
              <InfoItem
                label="Criada em"
                value={formatDate(profile?.created_at ?? user.created_at)}
              />
              <InfoItem label="Empresa" value={company?.name ?? 'Sem empresa'} />
            </div>
          </CardContent>
        </Card>

        <AccountForms fullName={fullName} />
      </div>
    </main>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  )
}
