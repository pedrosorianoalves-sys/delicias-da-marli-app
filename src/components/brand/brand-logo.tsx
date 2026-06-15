'use client'

import { useState } from 'react'
import Image from 'next/image'

import { cn } from '@/lib/utils'

const LOGO_SRC = '/brand/logo-delicias-da-marli.png'

interface BrandLogoProps {
  className?: string
  imageClassName?: string
  textClassName?: string
  showText?: boolean
  priority?: boolean
}

export function BrandLogo({
  className,
  imageClassName,
  textClassName,
  showText = true,
  priority = false,
}: BrandLogoProps) {
  const [imageFailed, setImageFailed] = useState(false)

  if (imageFailed) {
    return (
      <span
        className={cn(
          'font-bold tracking-tight text-foreground',
          textClassName,
        )}
      >
        Delícias da Marli
      </span>
    )
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="flex shrink-0 items-center justify-center rounded-md bg-white p-1.5 ring-1 ring-black/5">
        <Image
          src={LOGO_SRC}
          alt="Delícias da Marli"
          width={180}
          height={80}
          className={cn('h-10 w-auto object-contain', imageClassName)}
          onError={() => setImageFailed(true)}
          priority={priority}
        />
      </span>
      {showText && (
        <span
          className={cn(
            'font-bold tracking-tight text-foreground',
            textClassName,
          )}
        >
          Delícias da Marli
        </span>
      )}
    </div>
  )
}
