import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle>Você não tem permissão para acessar esta área.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se você acredita que deveria ter acesso, fale com a administração.
          </p>
          <Button variant="outline" render={<Link href="/cliente" />}>
            Ir para área do cliente
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
