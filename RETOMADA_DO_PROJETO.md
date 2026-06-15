# RETOMADA DO PROJETO — Delícias da Marli

Este documento serve como guia operacional e resumo técnico do estado atual do sistema de gestão artesanal **Delícias da Marli** para orientação e retomada imediata de desenvolvimento.

---

## 1. Estado Atual do Sistema

*   **Tecnologias centrais**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, e componentes shadcn/ui (estilo new-york).
*   **Banco de Dados & Autenticação**: Supabase PostgreSQL, Supabase Auth e Row Level Security (RLS) ativos para multi-tenancy.
*   **Estrutura de pastas**:
    *   `src/actions/`: Server Actions que controlam toda a lógica de negócios e persistência.
    *   `src/components/`: Componentes organizados por módulos de domínio (dashboard, ingredientes, compras, layout, ui, etc.).
    *   `src/app/`: Rotas divididas em grupos de layout: `(main)` para a área de gestão (ERP) e `(auth)` para login/cadastro.
*   **Status de Telas**:
    *   A área administrativa (ERP) possui stubs e implementações parciais (Dashboard, Ingredientes e Compras totalmente funcionais).
    *   A área comercial pública (`/loja` e `/cliente`) consiste apenas em stubs vazios de páginas.

---

## 2. Módulos Já Prontos

1.  **Autenticação e Rotas Protegidas**: Tela de login/cadastro e middleware de redirecionamento configurados para proteger o ERP.
2.  **Dashboard de Gestão**: Cartões com métricas operacionais estruturadas (CMV, Receita e Lucro Bruto) e card de alerta para ingredientes com estoque abaixo do limite mínimo.
3.  **CRUD de Ingredientes**: Cadastro completo com nome, unidade de medida, estoque atual, estoque mínimo, fornecedor e custo médio ponderado.
4.  **Movimentação & Compras de Ingredientes**: Registro de compras de insumos com recálculo matemático de custo médio ponderado em tempo real no servidor e registro automático de movimentação de estoque (`stock_movements`).

---

## 3. Migrations Já Criadas e Aplicação

As migrações já residem na pasta `supabase/migrations/` e definem o esquema inicial do Supabase:

1.  `20260613_0001_product_recipe_metrics.sql`: Definição de receitas, itens de receita e associação com ingredientes e custos.
2.  `20260613_0002_orders_sales.sql`: Tabelas de pedidos (`orders`), itens de pedido (`order_items`) e relacionamento com clientes.
3.  `20260613_0003_roles_permissions.sql`: Controle de papéis de usuários (`owner`, `admin`, `operator`, `customer`) com funções utilitárias de segurança baseadas em RLS.
4.  `20260613_0004_customer_default_and_user_permissions.sql`: Associa por padrão perfis criados a papéis e contém lógica de gatilho para novos usuários (**Atenção: contém o bug crítico**).

Todas estas migrações já estão criadas localmente e representam o estado atual do banco de dados de desenvolvimento.

---

## 4. Ponto Crítico: Corrigir Bug do Trigger/Onboarding Antes da Loja

> [!CAUTION]
> **Vulnerabilidade Crítica de Tenant**: Há um bug severo no trigger `handle_new_user()` criado na migration `0004`.

*   **O Bug**: Ao realizar o cadastro (`auth.signUp`), o trigger busca a empresa mais antiga cadastrada no banco e adiciona o novo usuário como `customer` desta empresa:
    ```sql
    SELECT id INTO target_company_id
    FROM public.companies
    ORDER BY created_at ASC
    LIMIT 1;
    ```
*   **Impacto**: Qualquer novo cadastro de usuário administrativo ou de cliente é automaticamente vinculado à primeira empresa criada no sistema, quebrando o isolamento dos dados.
*   **Correção Necessária**: O trigger deve ser alterado para criar **apenas** o perfil do usuário em `profiles`. A criação da empresa (`companies`) ou a associação do usuário a um tenant (`company_members`) deve ser realizada em uma etapa posterior explícita via interface e Server Actions (`createCompany` ou `joinByInvite`).

---

## 5. Próxima Ação Exata no Codex

A retomada de desenvolvimento deve seguir estritamente o roteiro abaixo:

1.  Criar o arquivo de migração `supabase/migrations/20260613_0005_fix_user_trigger_onboarding.sql`.
2.  Adicionar o comando SQL para recriar a função `handle_new_user()` e o trigger, removendo a associação automática a empresas e limitando a ação à criação do registro na tabela `profiles`.
3.  Implementar a Server Action `createCompanyOnboarding()` em `src/actions/onboarding.ts`.
4.  Criar a rota e página de onboarding `/onboarding` (`src/app/onboarding/page.tsx`), apresentando duas opções: "Criar uma nova empresa" ou "Entrar com código de convite".
5.  Atualizar o middleware em `src/middleware.ts` para que, caso o usuário esteja logado mas não pertença a nenhuma empresa (sem registros na tabela `company_members`), ele seja redirecionado exclusivamente para a rota `/onboarding`.

---

## 6. Modelo Recomendado para a Próxima Etapa

*   **Recomendação**: **Claude 3.5 Sonnet** (ou modelos especializados em raciocínio lógico e integridade de código).
*   **Justificativa**: A correção envolve manipulação direta de triggers de banco de dados do PostgreSQL, Row Level Security (RLS) no Supabase e a integração estrita com o middleware de roteamento do Next.js. Exige precisão para não violar regras de segurança multi-tenant.

---

## 7. Ordem Correta de Execução

1.  **Migration 0005**: Executar a migração que altera o comportamento do trigger.
2.  **Testar novo cadastro / customer**: Realizar o fluxo completo de cadastro com um novo email e verificar se ele é retido pelo middleware e redirecionado para a tela de onboarding, sem associação prévia a nenhuma empresa existente.
3.  **Iniciar Sprint 8 da Loja**: Somente com o fluxo de onboarding e tenant seguro e validado, iniciar o escopo da loja pública.

---

## 8. O que NÃO fazer ainda

*   **Não criar tabela de carrinho no banco**: O carrinho de compras deve ser persistido puramente no `localStorage` do cliente (`marli_cart_{slug_empresa}`) para manter a performance e simplicidade.
*   **Não criar cupons de desconto ou tabelas extras de promoções**: Promoções devem ser tratadas como campos diretos na tabela de produtos (`promotional_price`, `promotion_starts_at`, `promotion_ends_at`).
*   **Não implementar integrações de gateways de pagamento (Pix/Cartão)**: O checkout é manual, e a confirmação é feita via mensagem estruturada de WhatsApp enviada pelo cliente.
*   **Não implementar a área do cliente (`/cliente`) funcional**: Focaremos nela apenas na Sprint 9.
*   **Não liberar inserções anon genéricas no banco de dados via RLS**: O checkout guest deve passar por Server Actions para realizar validações prévias e sanitização.

---

## 9. Riscos Atuais

*   **Vazamento de dados (Segurança)**: Se a migration 0005 falhar ou for pulada, novos usuários verão dados de terceiros da empresa padrão do sistema.
*   **Normalização de Contato Guest**: O identificador único de clientes guest será o telefone. Falhas na normalização (remover caracteres especiais, adicionar DDI `55`) resultarão em cadastros de clientes duplicados ou conflitos de dados.
*   **Estoque Falso**: Se a validação de estoque de ingredientes não for executada no servidor durante a Server Action de criação da order, a loja poderá registrar vendas de produtos indisponíveis em estoque físico.

---

## 10. Checklist de Retomada

- [ ] Criar a `Migration 0005` para consertar o trigger `handle_new_user()`.
- [ ] Aplicar a migração no Supabase local (`npx supabase db push` ou equivalente).
- [ ] Criar a Server Action de onboarding e a rota `/onboarding`.
- [ ] Atualizar as permissões do middleware.
- [ ] Testar exaustivamente o cadastro e onboarding.
- [ ] Criar a `Migration 0006` (colunas promocionais em `products`, slug único, tokens em `orders`).
- [ ] Criar a `Migration 0007` (tabela de imagens de produtos, banners, tokens de convite).
- [ ] Criar a `Migration 0008` (políticas de RLS pública para produtos e imagens).
- [ ] Criar o contexto de carrinho de compras (`useCart`).
- [ ] Desenvolver a vitrine de produtos e categorias em `/loja`.
- [ ] Implementar a página de checkout guest `/loja/checkout`.
- [ ] Implementar página de sucesso `/loja/sucesso` com redirecionamento ao WhatsApp e timeline de pedido `/pedido/[token]`.
