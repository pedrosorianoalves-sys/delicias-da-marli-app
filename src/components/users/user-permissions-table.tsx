'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Save, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import {
  promoteCustomerToCompany,
  updateCompanyMemberRole,
  updateMemberProfileName,
} from '@/actions/members'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/constants'
import type {
  AvailableCustomerProfile,
  CompanyMemberWithProfile,
  MemberRole,
} from '@/types'

interface UserPermissionsTableProps {
  members: CompanyMemberWithProfile[]
  availableCustomers: AvailableCustomerProfile[]
  canEdit: boolean
}

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'operator', label: 'Operador' },
  { value: 'customer', label: 'Cliente' },
]

const PROMOTION_ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'operator', label: 'Operador' },
  { value: 'owner', label: 'Owner' },
]

const ROLE_BADGE_CLASS: Record<MemberRole, string> = {
  owner: 'bg-rose-100 text-rose-800',
  admin: 'bg-blue-100 text-blue-800',
  operator: 'bg-amber-100 text-amber-800',
  customer: 'bg-emerald-100 text-emerald-800',
}

export function UserPermissionsTable({
  members,
  availableCustomers,
  canEdit,
}: UserPermissionsTableProps) {
  const router = useRouter()
  const [roles, setRoles] = useState<Record<string, MemberRole>>(
    Object.fromEntries(members.map((member) => [member.id, member.role])),
  )
  const [promotionRoles, setPromotionRoles] = useState<Record<string, MemberRole>>(
    Object.fromEntries(
      availableCustomers.map((customer) => [customer.id, 'operator' as MemberRole]),
    ),
  )
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingNameId, setSavingNameId] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave(member: CompanyMemberWithProfile) {
    const nextRole = roles[member.id]
    if (!nextRole || nextRole === member.role) return

    setSavingId(member.id)
    startTransition(async () => {
      const result = await updateCompanyMemberRole(member.id, nextRole)
      setSavingId(null)

      if (result.success) {
        toast.success('Permissão atualizada.')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erro ao atualizar permissão.')
        setRoles((current) => ({ ...current, [member.id]: member.role }))
      }
    })
  }

  function handlePromote(customer: AvailableCustomerProfile) {
    const nextRole = promotionRoles[customer.id] ?? 'operator'

    setAddingId(customer.id)
    startTransition(async () => {
      const result = await promoteCustomerToCompany(customer.id, nextRole)
      setAddingId(null)

      if (result.success) {
        toast.success('Cliente adicionado à equipe.')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erro ao adicionar cliente à equipe.')
      }
    })
  }

  function handleNameSave(member: CompanyMemberWithProfile) {
    const nextName = nameEdits[member.user_id]?.trim()
    if (!nextName) return

    setSavingNameId(member.user_id)
    startTransition(async () => {
      const result = await updateMemberProfileName(member.user_id, nextName)
      setSavingNameId(null)

      if (result.success) {
        toast.success('Nome atualizado.')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erro ao atualizar nome.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Membros da equipe</h2>
          <p className="text-sm text-muted-foreground">
            Usuários já vinculados a esta empresa.
          </p>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Role atual</TableHead>
                <TableHead className="hidden lg:table-cell">Criado em</TableHead>
                <TableHead>Nova role</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => {
                  const selectedRole = roles[member.id] ?? member.role
                  const changed = selectedRole !== member.role
                  const displayName = getDisplayName(member)
                  const email = member.profile?.email ?? null
                  const canEditName =
                    canEdit &&
                    !!member.profile &&
                    (!member.profile?.full_name ||
                      (!!email && member.profile.full_name === email))

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-2">
                          <div>
                            {displayName}
                            {member.profile?.account_type && (
                              <Badge
                                variant="outline"
                                className="ml-2 align-middle text-[10px]"
                              >
                                {getAccountTypeLabel(member.profile.account_type)}
                              </Badge>
                            )}
                          </div>
                          {canEditName && (
                            <div className="flex max-w-xs items-center gap-2">
                              <Input
                                value={nameEdits[member.user_id] ?? ''}
                                onChange={(event) =>
                                  setNameEdits((current) => ({
                                    ...current,
                                    [member.user_id]: event.target.value,
                                  }))
                                }
                                placeholder="Nome do usuário"
                                className="h-8"
                              />
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                disabled={
                                  savingNameId === member.user_id ||
                                  !nameEdits[member.user_id]?.trim()
                                }
                                onClick={() => handleNameSave(member)}
                                aria-label="Salvar nome"
                              >
                                {savingNameId === member.user_id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Check className="size-3.5" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground md:hidden">
                          {email ?? '-'}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {email ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={ROLE_BADGE_CLASS[member.role]}>
                          {getRoleLabel(member.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {formatDate(member.created_at)}
                      </TableCell>
                      <TableCell>
                        <Select
                          disabled={!canEdit}
                          value={selectedRole}
                          onValueChange={(value) =>
                            setRoles((current) => ({
                              ...current,
                              [member.id]: value as MemberRole,
                            }))
                          }
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          disabled={!canEdit || !changed || isPending}
                          onClick={() => handleSave(member)}
                        >
                          {savingId === member.id ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Salvando
                            </>
                          ) : (
                            <>
                              <Save className="size-3.5" />
                              Salvar
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Clientes disponíveis</h2>
          <p className="text-sm text-muted-foreground">
            Clientes cadastrados ainda não acessam o painel admin. O owner pode
            adicioná-los à equipe quando necessário.
          </p>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Cadastro</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availableCustomers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Nenhum cliente disponível para promover.
                  </TableCell>
                </TableRow>
              ) : (
                availableCustomers.map((customer) => {
                  const selectedRole = promotionRoles[customer.id] ?? 'operator'
                  const customerName =
                    customer.full_name?.trim() || customer.email || 'Nome não informado'

                  return (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customerName}
                        <p className="text-xs text-muted-foreground md:hidden">
                          {customer.email ?? '-'}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {customer.email ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-100 text-emerald-800">
                          Cliente
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {formatDate(customer.created_at)}
                      </TableCell>
                      <TableCell>
                        <Select
                          disabled={!canEdit}
                          value={selectedRole}
                          onValueChange={(value) =>
                            setPromotionRoles((current) => ({
                              ...current,
                              [customer.id]: value as MemberRole,
                            }))
                          }
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROMOTION_ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          disabled={!canEdit || isPending}
                          onClick={() => handlePromote(customer)}
                        >
                          {addingId === customer.id ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Adicionando
                            </>
                          ) : (
                            <>
                              <UserPlus className="size-3.5" />
                              Adicionar à equipe
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}

function getRoleLabel(role: MemberRole) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}

function getDisplayName(member: CompanyMemberWithProfile) {
  const name = member.profile?.full_name?.trim()
  if (name) return name
  if (member.profile?.email) return member.profile.email
  return 'Perfil não encontrado'
}

function getAccountTypeLabel(accountType: string) {
  if (accountType === 'business_owner') return 'Equipe'
  if (accountType === 'customer') return 'Cliente'
  return accountType
}
