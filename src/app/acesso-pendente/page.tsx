import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PendingAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle>Acesso pendente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Seu usuário ainda não possui uma permissão clara na empresa.
          </p>
          <Button variant="outline" render={<Link href="/login" />}>
            Voltar ao login
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
