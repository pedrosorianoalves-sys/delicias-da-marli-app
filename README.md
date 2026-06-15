# Delícias da Marli

Sistema de gestão para produção artesanal de doces caseiros.

## Configuração local

Crie o arquivo `.env.local` com as chaves públicas do Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Não adicione `service_role` no frontend.

Coloque o logo em `public/brand/logo-delicias-da-marli.png`.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Validação

```bash
npm run lint
npx tsc --noEmit
npm run build
```
