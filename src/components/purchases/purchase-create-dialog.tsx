'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { PurchaseForm } from '@/components/purchases/purchase-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Ingredient } from '@/types'

interface PurchaseCreateDialogProps {
  ingredients: Ingredient[]
}

export function PurchaseCreateDialog({ ingredients }: PurchaseCreateDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button disabled={ingredients.length === 0} />}>
        <Plus className="size-4" />
        Nova compra
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova compra</DialogTitle>
          <DialogDescription>
            A entrada atualiza o estoque e recalcula o custo médio.
          </DialogDescription>
        </DialogHeader>
        <PurchaseForm
          ingredients={ingredients}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
