'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand/brand-logo'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Sidebar } from '@/components/layout/sidebar'
import type { MemberRole } from '@/types'

interface HeaderUser {
  full_name: string
  email: string
  role?: MemberRole
  role_label?: string
}

interface HeaderProps {
  user: HeaderUser
}

export function Header({ user }: HeaderProps) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm lg:hidden">
      {/* Hamburger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </Button>

      {/* Centered title */}
      <div className="flex flex-1 items-center justify-center">
        <BrandLogo
          imageClassName="h-8 max-w-20"
          textClassName="text-sm"
        />
      </div>

      {/* Spacer to balance the hamburger */}
      <div className="size-8" />

      {/* Mobile sidebar sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={true} className="w-64 p-0">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SheetDescription className="sr-only">
            Navegação principal do aplicativo
          </SheetDescription>
          <Sidebar user={user} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  )
}
