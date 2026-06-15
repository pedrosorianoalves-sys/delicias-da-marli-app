import { redirect } from 'next/navigation'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/actions/auth'
import { BrandLogo } from '@/components/brand/brand-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function CustomerAreaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="items-center gap-3">
          <BrandLogo imageClassName="h-14 max-w-36" showText={false} />
          <CardTitle>Área do cliente em construção</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Área do cliente em construção. Em breve você poderá acompanhar seus pedidos.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button render={<Link href="/minha-conta" />}>
              Minha Conta
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline">
                Sair
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
