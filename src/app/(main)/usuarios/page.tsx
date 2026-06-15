import { redirect } from 'next/navigation'

import { listCompanyMembersAndAvailableCustomers } from '@/actions/members'
import { requireCompanyRole } from '@/lib/auth/permissions'
import { UserPermissionsTable } from '@/components/users/user-permissions-table'

export default async function UsersPage() {
  const context = await requireCompanyRole(['owner', 'admin'])

  if ('error' in context) {
    redirect('/sem-permissao')
  }

  const { members, availableCustomers } =
    await listCompanyMembersAndAvailableCustomers()
  const canEdit = context.role === 'owner'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie permissões de administradores, operadores e clientes.
        </p>
      </div>

      {!canEdit && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Admins podem visualizar permissões. Apenas owners podem alterar roles.
        </div>
      )}

      <UserPermissionsTable
        members={members}
        availableCustomers={availableCustomers}
        canEdit={canEdit}
      />
    </div>
  )
}
