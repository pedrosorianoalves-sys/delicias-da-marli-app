import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ADMIN_PATHS = [
  '/dashboard',
  '/importar',
  '/ingredientes',
  '/compras',
  '/produtos',
  '/receitas',
  '/clientes',
  '/pedidos',
  '/relatorios',
]

const MANAGEMENT_PATHS = ['/usuarios']

function isAdminPath(pathname: string) {
  return ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function isManagementPath(pathname: string) {
  return MANAGEMENT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function isCustomerPath(pathname: string) {
  return pathname === '/cliente' || pathname.startsWith('/cliente/')
}

function isAccountPath(pathname: string) {
  return pathname === '/minha-conta' || pathname.startsWith('/minha-conta/')
}

function isOnboardingPath(pathname: string) {
  return pathname === '/onboarding' || pathname.startsWith('/onboarding/')
}

function isPublicPath(pathname: string) {
  return pathname === '/' || pathname === '/loja' || pathname.startsWith('/loja/')
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not use supabase.auth.getSession() — it reads from storage
  // and is not guaranteed to be up to date. Use getUser() instead.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isPublicPage = isPublicPath(request.nextUrl.pathname)
  const isProtectedAdminPage = isAdminPath(request.nextUrl.pathname)
  const isProtectedManagementPage = isManagementPath(request.nextUrl.pathname)
  const isCustomerPage = isCustomerPath(request.nextUrl.pathname)
  const isAccountPage = isAccountPath(request.nextUrl.pathname)
  const isOnboardingPage = isOnboardingPath(request.nextUrl.pathname)

  // If not logged in and trying to access protected route, redirect to login
  if (!user && !isAuthPage && !isPublicPage) {
    return redirectTo(request, '/login')
  }

  if (user) {
    const { data: member } = await supabase
      .from('company_members')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle<{ role: string }>()

    const role = member?.role
    const isAdminRole = role === 'owner' || role === 'admin' || role === 'operator'
    const isManagementRole = role === 'owner' || role === 'admin'

    // If logged in and trying to access login page, redirect by role
    if (isAuthPage) {
      if (isAdminRole) return redirectTo(request, '/dashboard')
      return redirectTo(request, '/cliente')
    }

    if (!role) {
      if (isProtectedAdminPage || isProtectedManagementPage) {
        return redirectTo(request, '/sem-permissao')
      }

      if (!isCustomerPage && !isPublicPage && !isAccountPage) {
        return redirectTo(request, '/cliente')
      }

      return supabaseResponse
    }

    if (isOnboardingPage) {
      if (role === 'customer') return redirectTo(request, '/cliente')
      if (isAdminRole) return redirectTo(request, '/dashboard')
      return redirectTo(request, '/cliente')
    }

    if (isProtectedManagementPage && !isManagementRole) {
      return redirectTo(request, '/sem-permissao')
    }

    if (isProtectedAdminPage && role === 'customer') {
      return redirectTo(request, '/sem-permissao')
    }

    if (isProtectedAdminPage && !isAdminRole) {
      return redirectTo(request, '/acesso-pendente')
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
