'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wheat,
  ShoppingCart,
  Package,
  BookOpen,
  Users,
  ClipboardList,
  BarChart3,
  FileJson,
  UserCog,
  UserCircle,
  LogOut,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/brand/brand-logo'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import type { MemberRole } from '@/types'
import { useRouter } from 'next/navigation'

// ── Navigation items (exported for reuse in mobile header) ──
export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  disabled?: boolean
  roles?: MemberRole[]
}

export const sidebarNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Importar', href: '/importar', icon: FileJson },
  { label: 'Ingredientes', href: '/ingredientes', icon: Wheat },
  { label: 'Compras', href: '/compras', icon: ShoppingCart },
  { label: 'Produtos', href: '/produtos', icon: Package },
  { label: 'Receitas', href: '/receitas', icon: BookOpen },
  { label: 'Clientes', href: '/clientes', icon: Users },
  { label: 'Pedidos', href: '/pedidos', icon: ClipboardList },
  { label: 'Relatórios', href: '/relatorios', icon: BarChart3 },
  { label: 'Usuários', href: '/usuarios', icon: UserCog, roles: ['owner', 'admin'] },
  { label: 'Minha Conta', href: '/minha-conta', icon: UserCircle },
]

// ── Types ──
interface SidebarUser {
  full_name: string
  email: string
  role?: MemberRole
  role_label?: string
}

interface SidebarProps {
  user: SidebarUser
  onNavigate?: () => void
}

// ── Helper: get initials ──
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

// ── Sidebar Component ──
export function Sidebar({ user, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleItems =
    user.role === 'customer'
      ? sidebarNavItems.filter((item) => item.href === '/cliente' || item.href === '/loja')
      : sidebarNavItems.filter(
          (item) => !item.roles || (!!user.role && item.roles.includes(user.role)),
        )
  const mainNav = visibleItems.slice(0, 3)
  const secondaryNav = visibleItems.slice(3)

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 py-6">
        <BrandLogo
          imageClassName="h-10 max-w-16"
          textClassName="text-base text-sidebar-primary-foreground"
        />
      </div>

      <Separator className="bg-sidebar-border" />

      {/* ── Navigation ── */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {/* Main group */}
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Principal
        </p>
        {mainNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon
                className={cn(
                  'size-[18px] shrink-0 transition-colors',
                  isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground'
                )}
              />
              {item.label}
            </Link>
          )
        })}

        <Separator className="my-3 bg-sidebar-border" />

        {/* Secondary group */}
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Produção & Vendas
        </p>
        {secondaryNav.map((item) => {
          const isActive = !item.disabled && (pathname === item.href || pathname.startsWith(item.href + '/'))
          const Icon = item.icon

          if (item.disabled) {
            return (
              <span
                key={item.href}
                className="group flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/30"
              >
                <Icon className="size-[18px] shrink-0" />
                {item.label}
                <Badge
                  variant="outline"
                  className="ml-auto border-sidebar-border/50 text-[10px] text-sidebar-foreground/30"
                >
                  Em breve
                </Badge>
              </span>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon
                className={cn(
                  'size-[18px] shrink-0 transition-colors',
                  isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground'
                )}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* ── User section ── */}
      <Separator className="bg-sidebar-border" />
      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar size="default">
          <AvatarFallback className="bg-sidebar-primary/20 text-xs font-semibold text-sidebar-primary">
            {getInitials(user.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-sidebar-foreground">
              {user.full_name}
            </span>
            {user.role_label && (
              <Badge
                variant="outline"
                className="shrink-0 border-sidebar-border/60 text-[10px] text-sidebar-foreground/60"
              >
                {user.role_label}
              </Badge>
            )}
          </div>
          <span className="truncate text-xs text-sidebar-foreground/50">
            {user.email}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleSignOut}
          className="shrink-0 text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Sair"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </aside>
  )
}
