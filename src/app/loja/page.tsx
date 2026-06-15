import { getPublicCatalogProducts } from '@/actions/public-catalog'
import { BrandLogo } from '@/components/brand/brand-logo'
import { PublicCatalog } from '@/components/store/public-catalog'

export default async function StorePage() {
  const products = await getPublicCatalogProducts()

  return (
    <main className="min-h-screen bg-[#fff8f5]">
      <header className="border-b border-rose-100 bg-white/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <BrandLogo
            imageClassName="h-12 max-w-32"
            textClassName="text-base text-rose-950"
            showText
            priority
          />
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Catálogo online
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-rose-700">Delícias artesanais</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-rose-950 sm:text-4xl">
            Escolha seus doces favoritos
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Produtos feitos com carinho, preparados para deixar seu dia mais
            gostoso.
          </p>
        </div>

        <PublicCatalog products={products} />
      </section>
    </main>
  )
}
