export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 via-amber-50/30 to-stone-100 px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
