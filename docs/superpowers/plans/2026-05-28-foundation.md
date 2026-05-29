# Med Mind — Fundação: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a base do projeto Med Mind — Módulo Consultório: Next.js 15 + Supabase + autenticação completa (login, cadastro, recuperação de senha) + middleware de proteção de rotas + Dockerfile funcional pronto para deploy no Easypanel.

**Architecture:** Next.js 15 App Router com TypeScript e Tailwind CSS puro. Supabase para banco (PostgreSQL + RLS) e autenticação. Dois clientes Supabase separados: browser (`createBrowserClient`) e server (`createServerClient` com cookies). Middleware intercept todas as rotas não-estáticas e redireciona baseado em sessão. Deploy via Dockerfile multi-stage com `output: standalone`.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase (`@supabase/ssr` + `@supabase/supabase-js`), OpenAI SDK, Vitest, Playwright, Docker, Easypanel.

---

## Pré-requisitos (manual — antes de começar)

- [ ] Ter Node.js >= 22 instalado (`node --version`)
- [ ] Ter Supabase CLI instalado: `npm install -g supabase`
- [ ] Ter `gh` CLI instalado (GitHub CLI) ou criar repo GitHub manualmente
- [ ] Ter conta Supabase com projeto criado. Anotar:
  - Project URL (ex: `https://xyzxyz.supabase.co`)
  - Anon key (painel Supabase → Settings → API)
  - Service role key (painel Supabase → Settings → API)
- [ ] Ter chave OpenAI disponível
- [ ] Vincular Supabase CLI ao projeto:
  ```bash
  supabase login
  supabase link --project-ref <seu-project-ref>
  ```

---

## Mapa de arquivos

```
.
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── next.config.ts
├── package.json
├── playwright.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── vitest.setup.ts
├── supabase/
│   └── migrations/
│       └── 0001_create_profiles.sql
├── e2e/
│   └── auth.spec.ts
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── (auth)/
    │   │   ├── layout.tsx
    │   │   ├── login/page.tsx
    │   │   ├── register/page.tsx
    │   │   └── reset-password/page.tsx
    │   ├── (dashboard)/
    │   │   ├── layout.tsx
    │   │   └── dashboard/page.tsx
    │   └── api/
    │       ├── ai/route.ts
    │       └── ab4/route.ts
    ├── components/
    │   ├── ui/
    │   │   ├── Button.tsx
    │   │   └── Input.tsx
    │   └── layout/
    │       └── Shell.tsx
    ├── lib/
    │   ├── auth/
    │   │   └── redirect.ts
    │   ├── supabase/
    │   │   ├── client.ts
    │   │   └── server.ts
    │   └── openai/
    │       └── client.ts
    ├── middleware.ts
    ├── types/
    │   ├── database.ts
    │   └── domain.ts
    └── utils/
        └── .gitkeep
```

---

## Task 1: Inicializar projeto Next.js + git + GitHub

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `.gitignore`

- [ ] **Step 1: Criar o projeto com create-next-app**

  Executar no diretório `C:\Users\ander\OneDrive\Documentos\Simulador`:
  ```bash
  npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-turbopack --import-alias "@/*"
  ```
  Quando perguntar "Would you like to use Turbopack?" → **No**
  Quando perguntar sobre import alias → aceitar `@/*`

- [ ] **Step 2: Verificar que o projeto inicia**
  ```bash
  npm run dev
  ```
  Esperado: servidor em `http://localhost:3000` sem erros no terminal.
  Parar com `Ctrl+C`.

- [ ] **Step 3: Limpar arquivos de demonstração do create-next-app**

  Substituir `src/app/page.tsx` (redirect inteligente baseado em sessão — implementado na Task 10):
  ```tsx
  export default function RootPage() {
    return null
  }
  ```

  Substituir `src/app/globals.css` pelo mínimo necessário:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```

  Substituir `src/app/layout.tsx`:
  ```tsx
  import type { Metadata } from 'next'
  import { Geist } from 'next/font/google'
  import './globals.css'

  const geist = Geist({ subsets: ['latin'] })

  export const metadata: Metadata = {
    title: 'Med Mind — Módulo Consultório',
    description: 'Simulador gamificado de consultório clínico',
  }

  export default function RootLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
      <html lang="pt-BR">
        <body className={geist.className}>{children}</body>
      </html>
    )
  }
  ```

- [ ] **Step 4: Verificar que o projeto ainda compila**
  ```bash
  npm run build
  ```
  Esperado: build sem erros.

- [ ] **Step 5: Adicionar `.env.local` ao `.gitignore`**

  Abrir `.gitignore` e confirmar que a linha abaixo existe (create-next-app já adiciona, mas verificar):
  ```
  .env.local
  .env*.local
  ```

- [ ] **Step 6: Criar repositório GitHub e fazer push inicial**
  ```bash
  git add .
  git commit -m "chore: initialize Next.js 15 project"
  gh repo create med-mind-consultorio --private --source=. --push
  ```
  Ou manualmente pelo GitHub e `git remote add origin <url> && git push -u origin main`.

---

## Task 2: Configuração de build (next.config.ts + Dockerfile)

**Files:**
- Modify: `next.config.ts`
- Create: `Dockerfile`, `.dockerignore`, `.env.example`

- [ ] **Step 1: Substituir next.config.ts**

  ```ts
  import type { NextConfig } from 'next'

  const nextConfig: NextConfig = {
    output: 'standalone',
    // images.remotePatterns: adicionar quando houver imagens externas
    // serverExternalPackages: adicionar se OpenAI SDK não buildar
  }

  export default nextConfig
  ```

- [ ] **Step 2: Criar Dockerfile na raiz do projeto**

  ```dockerfile
  # Stage 1: build
  FROM node:22-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  # Stage 2: runtime
  FROM node:22-alpine AS runner
  WORKDIR /app
  ENV NODE_ENV=production
  ENV HOSTNAME=0.0.0.0
  COPY --from=builder /app/.next/standalone ./
  COPY --from=builder /app/.next/static ./.next/static
  COPY --from=builder /app/public ./public
  EXPOSE 3000
  CMD ["node", "server.js"]
  ```

- [ ] **Step 3: Criar .dockerignore na raiz**

  ```
  node_modules
  .next
  .git
  .env
  .env.local
  .env*.local
  npm-debug.log*
  README.md
  ```

- [ ] **Step 4: Criar .env.example na raiz**

  ```
  NEXT_PUBLIC_SUPABASE_URL=your-project-url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
  OPENAI_API_KEY=your-openai-key
  ```

- [ ] **Step 5: Criar .env.local com valores reais** (nunca commitar este arquivo)

  ```
  NEXT_PUBLIC_SUPABASE_URL=<sua-url-supabase>
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<sua-anon-key>
  SUPABASE_SERVICE_ROLE_KEY=<sua-service-role-key>
  OPENAI_API_KEY=<sua-openai-key>
  ```

- [ ] **Step 6: Verificar que build standalone funciona**
  ```bash
  npm run build
  ```
  Esperado: pasta `.next/standalone` criada, arquivo `.next/standalone/server.js` presente.

- [ ] **Step 7: Commit**
  ```bash
  git add next.config.ts Dockerfile .dockerignore .env.example
  git commit -m "chore: add Dockerfile and build configuration"
  ```

---

## Task 3: Infraestrutura de testes (Vitest + Playwright)

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `e2e/auth.spec.ts`

- [ ] **Step 1: Instalar dependências de teste**
  ```bash
  npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
  npm install -D @playwright/test
  ```

- [ ] **Step 2: Criar vitest.config.ts**

  ```ts
  import { defineConfig } from 'vitest/config'
  import react from '@vitejs/plugin-react'
  import path from 'path'

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  })
  ```

- [ ] **Step 3: Criar vitest.setup.ts**

  ```ts
  import '@testing-library/jest-dom'
  ```

- [ ] **Step 4: Adicionar script de test ao package.json**

  Abrir `package.json` e adicionar em `"scripts"`:
  ```json
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
  ```

- [ ] **Step 5: Criar playwright.config.ts**

  ```ts
  import { defineConfig, devices } from '@playwright/test'

  export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    retries: 0,
    use: {
      baseURL: 'http://localhost:3000',
      trace: 'on-first-retry',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
    },
  })
  ```

- [ ] **Step 6: Instalar browsers do Playwright**
  ```bash
  npx playwright install chromium
  ```

- [ ] **Step 7: Criar e2e/auth.spec.ts com estrutura inicial (testes serão completados na Task 7-9)**

  ```ts
  import { test, expect } from '@playwright/test'

  test('redireciona usuário não autenticado para login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/.*login/)
  })
  ```

- [ ] **Step 8: Verificar que o Vitest roda sem erros**
  ```bash
  npm test
  ```
  Esperado: `No test files found` ou testes passando — sem erros de configuração.

- [ ] **Step 9: Commit**
  ```bash
  git add vitest.config.ts vitest.setup.ts playwright.config.ts e2e/
  git add package.json package-lock.json
  git commit -m "chore: add Vitest and Playwright test infrastructure"
  ```

---

## Task 4: Clientes Supabase

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`

- [ ] **Step 1: Instalar dependências Supabase**
  ```bash
  npm install @supabase/supabase-js @supabase/ssr
  ```
  Anotar a versão instalada de `@supabase/ssr` em um comentário no `package.json` ou no README — **não atualizar sem testar o fluxo de auth completo**.

- [ ] **Step 2: Criar placeholder src/types/database.ts** (será substituído na Task 5 pelo gerado)

  ```ts
  // ARQUIVO GERADO AUTOMATICAMENTE
  // Rodar após aplicar migrations: supabase gen types typescript --linked > src/types/database.ts
  // Não editar manualmente

  export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

  export type Database = {
    public: {
      Tables: {
        profiles: {
          Row: {
            id: string
            full_name: string
            crm: string | null
            role: string
            created_at: string
            updated_at: string
          }
          Insert: {
            id: string
            full_name: string
            crm?: string | null
            role?: string
            created_at?: string
            updated_at?: string
          }
          Update: {
            id?: string
            full_name?: string
            crm?: string | null
            role?: string
            created_at?: string
            updated_at?: string
          }
          Relationships: []
        }
      }
      Views: Record<string, never>
      Functions: Record<string, never>
      Enums: Record<string, never>
      CompositeTypes: Record<string, never>
    }
  }
  ```

- [ ] **Step 3: Criar src/lib/supabase/client.ts**

  ```ts
  import { createBrowserClient } from '@supabase/ssr'
  import type { Database } from '@/types/database'

  export function createClient() {
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  ```

- [ ] **Step 4: Criar src/lib/supabase/server.ts**

  ```ts
  import { createServerClient } from '@supabase/ssr'
  import { cookies } from 'next/headers'
  import type { Database } from '@/types/database'

  export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Chamado de Server Component (read-only) — ignorar
            }
          },
        },
      }
    )
  }
  ```

- [ ] **Step 5: Verificar que o projeto compila com os clientes**
  ```bash
  npm run build
  ```
  Esperado: build sem erros de TypeScript.

- [ ] **Step 6: Commit**
  ```bash
  git add src/lib/supabase/ src/types/database.ts
  git commit -m "feat: add Supabase browser and server clients"
  ```

---

## Task 5: Migration do banco + tipos TypeScript + tipos de domínio

**Files:**
- Create: `supabase/migrations/0001_create_profiles.sql`, `src/types/domain.ts`
- Regenerate: `src/types/database.ts`

- [ ] **Step 1: Criar pasta de migrations**
  ```bash
  supabase migration new create_profiles
  ```
  Isso cria `supabase/migrations/<timestamp>_create_profiles.sql`.

- [ ] **Step 2: Preencher o arquivo de migration criado com o SQL completo**

  Abrir o arquivo em `supabase/migrations/<timestamp>_create_profiles.sql` e substituir o conteúdo por:

  ```sql
  -- Tabela principal de perfis de usuário
  CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT NOT NULL CHECK (full_name <> ''),
    crm         TEXT,
    role        TEXT NOT NULL DEFAULT 'student'
                  CHECK (role IN ('student', 'resident', 'physician')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Permissões explícitas para o role autenticado
  -- DELETE intencionalmente excluído: usuários não se auto-deletam neste produto
  GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

  -- RLS
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Usuário insere próprio perfil"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

  CREATE POLICY "Usuário lê próprio perfil"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

  CREATE POLICY "Usuário edita próprio perfil"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

  -- Trigger: atualiza updated_at automaticamente
  CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

  -- Trigger: cria perfil automaticamente após cadastro
  CREATE OR REPLACE FUNCTION handle_new_user()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.raw_user_meta_data->>'full_name' IS NULL
       OR NEW.raw_user_meta_data->>'full_name' = '' THEN
      RAISE EXCEPTION 'full_name é obrigatório no cadastro';
    END IF;

    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      COALESCE(NEW.raw_user_meta_data->>'role', 'student')
    );
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

  -- Proteção contra search-path hijacking em função SECURITY DEFINER
  ALTER FUNCTION handle_new_user() SET search_path = public;
  ```

- [ ] **Step 3: Aplicar migration no Supabase remoto**
  ```bash
  supabase migration up
  ```
  Esperado: `Applied 1 migration` sem erros.

- [ ] **Step 4: Verificar a tabela no Supabase dashboard**

  Abrir Supabase Dashboard → Table Editor → confirmar que `profiles` existe com as colunas corretas e RLS ativado.

- [ ] **Step 5: Gerar tipos TypeScript do schema**
  ```bash
  supabase gen types typescript --linked > src/types/database.ts
  ```
  Esperado: `src/types/database.ts` atualizado com os tipos gerados do Supabase. O arquivo terá muito mais conteúdo que o placeholder da Task 4 — isso é esperado.

- [ ] **Step 6: Criar src/types/domain.ts**

  ```ts
  import type { Database } from './database'

  export type Profile = Database['public']['Tables']['profiles']['Row']
  export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
  export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

  export type Role = 'student' | 'resident' | 'physician'
  ```

- [ ] **Step 7: Verificar que o TypeScript compila**
  ```bash
  npm run build
  ```
  Esperado: build sem erros.

- [ ] **Step 8: Commit**
  ```bash
  git add supabase/ src/types/
  git commit -m "feat: add profiles migration and TypeScript types"
  ```

---

## Task 6: Lógica de redirect + middleware

**Files:**
- Create: `src/lib/auth/redirect.ts`, `src/lib/auth/redirect.test.ts`, `src/middleware.ts`

- [ ] **Step 1: Escrever o teste que vai falhar**

  Criar `src/lib/auth/redirect.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest'
  import { getRedirectPath } from './redirect'

  describe('getRedirectPath', () => {
    it('redireciona usuário não autenticado do dashboard para login', () => {
      expect(getRedirectPath('/dashboard', false)).toBe('/login')
    })

    it('redireciona usuário não autenticado de rota privada qualquer para login', () => {
      expect(getRedirectPath('/patients', false)).toBe('/login')
    })

    it('redireciona usuário autenticado do login para dashboard', () => {
      expect(getRedirectPath('/login', true)).toBe('/dashboard')
    })

    it('redireciona usuário autenticado do register para dashboard', () => {
      expect(getRedirectPath('/register', true)).toBe('/dashboard')
    })

    it('redireciona usuário autenticado do reset-password para dashboard', () => {
      expect(getRedirectPath('/reset-password', true)).toBe('/dashboard')
    })

    it('permite usuário não autenticado na página de login', () => {
      expect(getRedirectPath('/login', false)).toBeNull()
    })

    it('permite usuário não autenticado no register', () => {
      expect(getRedirectPath('/register', false)).toBeNull()
    })

    it('permite usuário autenticado no dashboard', () => {
      expect(getRedirectPath('/dashboard', true)).toBeNull()
    })
  })
  ```

- [ ] **Step 2: Rodar o teste para confirmar que falha**
  ```bash
  npm test
  ```
  Esperado: FAIL — `Cannot find module './redirect'`

- [ ] **Step 3: Criar src/lib/auth/redirect.ts**

  ```ts
  const AUTH_ROUTES = ['/login', '/register', '/reset-password']

  export function getRedirectPath(
    pathname: string,
    isAuthenticated: boolean
  ): string | null {
    const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

    if (!isAuthenticated && !isAuthRoute) return '/login'
    if (isAuthenticated && isAuthRoute) return '/dashboard'
    return null
  }
  ```

- [ ] **Step 4: Rodar o teste para confirmar que passa**
  ```bash
  npm test
  ```
  Esperado: 8 testes passando.

- [ ] **Step 5: Criar src/middleware.ts**

  ```ts
  import { createServerClient } from '@supabase/ssr'
  import { NextResponse, type NextRequest } from 'next/server'
  import { getRedirectPath } from '@/lib/auth/redirect'

  export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Usar getUser() — valida sessão no servidor, nunca getSession()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const redirectPath = getRedirectPath(request.nextUrl.pathname, !!user)

    if (redirectPath) {
      const url = request.nextUrl.clone()
      url.pathname = redirectPath
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  export const config = {
    matcher: [
      '/((?!_next/static|_next/image|favicon.ico|api).*)',
    ],
  }
  ```

- [ ] **Step 6: Verificar que o build compila**
  ```bash
  npm run build
  ```
  Esperado: build sem erros.

- [ ] **Step 7: Commit**
  ```bash
  git add src/lib/auth/ src/middleware.ts
  git commit -m "feat: add auth redirect logic and middleware"
  ```

---

## Task 7: Componentes UI (Button + Input)

**Files:**
- Create: `src/components/ui/Button.tsx`, `src/components/ui/Input.tsx`

- [ ] **Step 1: Criar src/components/ui/Button.tsx**

  ```tsx
  import { type ButtonHTMLAttributes } from 'react'

  interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary'
    loading?: boolean
  }

  export function Button({
    variant = 'primary',
    loading = false,
    children,
    className = '',
    disabled,
    ...props
  }: ButtonProps) {
    const base =
      'w-full px-4 py-2 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      secondary:
        'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400',
    }

    return (
      <button
        className={`${base} ${variants[variant]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? 'Aguarde...' : children}
      </button>
    )
  }
  ```

- [ ] **Step 2: Criar src/components/ui/Input.tsx**

  ```tsx
  import { type InputHTMLAttributes } from 'react'

  interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
  }

  export function Input({
    label,
    error,
    className = '',
    id,
    ...props
  }: InputProps) {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          id={id}
          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }
  ```

- [ ] **Step 3: Verificar que compila**
  ```bash
  npm run build
  ```
  Esperado: build sem erros.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/ui/
  git commit -m "feat: add Button and Input UI components"
  ```

---

## Task 8: Páginas de autenticação (login + layout)

**Files:**
- Create: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Criar src/app/(auth)/layout.tsx**

  ```tsx
  export default function AuthLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Med Mind</h1>
            <p className="text-sm text-gray-500 mt-1">Módulo Consultório</p>
          </div>
          {children}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Criar src/app/(auth)/login/page.tsx**

  ```tsx
  'use client'

  import { useState } from 'react'
  import Link from 'next/link'
  import { useRouter } from 'next/navigation'
  import { createClient } from '@/lib/supabase/client'
  import { Button } from '@/components/ui/Button'
  import { Input } from '@/components/ui/Input'

  export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    async function handleLogin(e: React.FormEvent) {
      e.preventDefault()
      setLoading(true)
      setError(null)

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError('E-mail ou senha incorretos.')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    }

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Entrar</h2>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input
            id="email"
            label="E-mail"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            id="password"
            label="Senha"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <Button type="submit" loading={loading}>
            Entrar
          </Button>
        </form>

        <div className="mt-4 flex flex-col gap-2 text-center text-sm">
          <Link
            href="/reset-password"
            className="text-blue-600 hover:underline"
          >
            Esqueci minha senha
          </Link>
          <p className="text-gray-500">
            Não tem conta?{' '}
            <Link href="/register" className="text-blue-600 hover:underline">
              Cadastrar
            </Link>
          </p>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 3: Verificar visualmente no navegador**
  ```bash
  npm run dev
  ```
  Abrir `http://localhost:3000/login`. Confirmar: formulário renderiza, campos funcionam, botão desabilita durante loading.

- [ ] **Step 4: Verificar que o redirecionamento funciona**

  Tentar acessar `http://localhost:3000/dashboard`. Esperado: redirecionar para `/login`.

- [ ] **Step 5: Commit**
  ```bash
  git add src/app/\(auth\)/
  git commit -m "feat: add auth layout and login page"
  ```

---

## Task 9: Página de cadastro

**Files:**
- Create: `src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Criar src/app/(auth)/register/page.tsx**

  ```tsx
  'use client'

  import { useState } from 'react'
  import Link from 'next/link'
  import { useRouter } from 'next/navigation'
  import { createClient } from '@/lib/supabase/client'
  import { Button } from '@/components/ui/Button'
  import { Input } from '@/components/ui/Input'
  import type { Role } from '@/types/domain'

  export default function RegisterPage() {
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [crm, setCrm] = useState('')
    const [role, setRole] = useState<Role>('student')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    async function handleRegister(e: React.FormEvent) {
      e.preventDefault()
      setLoading(true)
      setError(null)

      if (!fullName.trim()) {
        setError('Nome completo é obrigatório.')
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
            crm: crm.trim() || null,
          },
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    }

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Criar conta</h2>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <Input
            id="fullName"
            label="Nome completo"
            type="text"
            name="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            id="email"
            label="E-mail"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            id="password"
            label="Senha"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="role" className="text-sm font-medium text-gray-700">
              Perfil
            </label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="student">Estudante de medicina</option>
              <option value="resident">Residente</option>
              <option value="physician">Médico</option>
            </select>
          </div>

          <Input
            id="crm"
            label="CRM (opcional)"
            type="text"
            name="crm"
            value={crm}
            onChange={(e) => setCrm(e.target.value)}
            placeholder="Ex: SP-123456"
          />

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <Button type="submit" loading={loading}>
            Criar conta
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Já tem conta?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verificar visualmente no navegador**

  Abrir `http://localhost:3000/register`. Confirmar: campos renderizam, select de perfil funciona.

- [ ] **Step 3: Testar cadastro manualmente**

  Preencher o formulário com dados válidos e submeter. Esperado: redirecionar para `/dashboard` e perfil criado no Supabase (verificar em Table Editor → profiles).

- [ ] **Step 4: Adicionar teste E2E ao e2e/auth.spec.ts**

  Substituir o conteúdo de `e2e/auth.spec.ts`:

  ```ts
  import { test, expect } from '@playwright/test'

  const timestamp = Date.now()
  const testUser = {
    fullName: 'Test User Foundation',
    email: `test-${timestamp}@medmind-test.dev`,
    password: 'TestPass123!',
  }

  test.describe('Autenticação', () => {
    test('redireciona usuário não autenticado para login', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/.*login/)
    })

    test('cadastro de novo usuário redireciona para dashboard', async ({
      page,
    }) => {
      await page.goto('/register')
      await page.fill('#fullName', testUser.fullName)
      await page.fill('#email', testUser.email)
      await page.fill('#password', testUser.password)
      await page.selectOption('#role', 'student')
      await page.click('[type="submit"]')
      await expect(page).toHaveURL(/.*dashboard/)
    })

    test('login após cadastro redireciona para dashboard', async ({ page }) => {
      await page.goto('/login')
      await page.fill('#email', testUser.email)
      await page.fill('#password', testUser.password)
      await page.click('[type="submit"]')
      await expect(page).toHaveURL(/.*dashboard/)
    })

    test('usuário autenticado é redirecionado do login para dashboard', async ({
      page,
    }) => {
      // Login primeiro
      await page.goto('/login')
      await page.fill('#email', testUser.email)
      await page.fill('#password', testUser.password)
      await page.click('[type="submit"]')
      await expect(page).toHaveURL(/.*dashboard/)

      // Tentar voltar para login deve redirecionar para dashboard
      await page.goto('/login')
      await expect(page).toHaveURL(/.*dashboard/)
    })
  })
  ```

- [ ] **Step 5: Commit**
  ```bash
  git add src/app/\(auth\)/register/ e2e/
  git commit -m "feat: add register page and E2E auth tests"
  ```

---

## Task 10: Página de recuperação de senha

**Files:**
- Create: `src/app/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Criar src/app/(auth)/reset-password/page.tsx**

  ```tsx
  'use client'

  import { useState, useEffect, useMemo } from 'react'
  import { useRouter } from 'next/navigation'
  import { createClient } from '@/lib/supabase/client'
  import { Button } from '@/components/ui/Button'
  import { Input } from '@/components/ui/Input'

  type PageState = 'request' | 'set-password' | 'success' | 'error'

  function ResetPasswordContent() {
    const [email, setEmail] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [pageState, setPageState] = useState<PageState>('request')
    const [message, setMessage] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    // useMemo garante instância estável do cliente entre renders
    const supabase = useMemo(() => createClient(), [])

    useEffect(() => {
      // Ler code diretamente do window para evitar dependência de useSearchParams
      // (useSearchParams em Next.js 15 requer Suspense boundary)
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (!code) return

      // Trocar code por sessão — etapa obrigatória antes do updateUser
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setPageState('error')
          setMessage('Link inválido ou expirado. Solicite um novo link.')
        } else {
          setPageState('set-password')
        }
      })
    }, [supabase])

    async function handleRequestReset(e: React.FormEvent) {
      e.preventDefault()
      setLoading(true)

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      setLoading(false)

      if (error) {
        setMessage('Erro ao enviar e-mail. Tente novamente.')
      } else {
        setMessage('E-mail enviado! Verifique sua caixa de entrada.')
      }
    }

    async function handleSetPassword(e: React.FormEvent) {
      e.preventDefault()
      setLoading(true)

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      setLoading(false)

      if (error) {
        setMessage('Erro ao atualizar senha. Tente novamente.')
      } else {
        setPageState('success')
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    }

    if (pageState === 'error') {
      return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-red-600 text-sm">{message}</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setPageState('request')
              setMessage(null)
            }}
          >
            Solicitar novo link
          </Button>
        </div>
      )
    }

    if (pageState === 'success') {
      return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-green-600 text-sm font-medium">
            Senha atualizada! Redirecionando...
          </p>
        </div>
      )
    }

    if (pageState === 'set-password') {
      return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Nova senha
          </h2>
          <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
            <Input
              id="newPassword"
              label="Nova senha"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            {message && (
              <p className="text-sm text-red-600 text-center">{message}</p>
            )}
            <Button type="submit" loading={loading}>
              Salvar nova senha
            </Button>
          </form>
        </div>
      )
    }

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Recuperar senha
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Enviaremos um link para o seu e-mail.
        </p>
        <form onSubmit={handleRequestReset} className="flex flex-col gap-4">
          <Input
            id="email"
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {message && (
            <p className="text-sm text-gray-600 text-center">{message}</p>
          )}
          <Button type="submit" loading={loading}>
            Enviar link
          </Button>
        </form>
      </div>
    )
  }

  export default function ResetPasswordPage() {
    return <ResetPasswordContent />
  }
  ```

- [ ] **Step 2: Verificar visualmente**

  Abrir `http://localhost:3000/reset-password`. Confirmar: formulário de solicitação renderiza. Testar com e-mail cadastrado e verificar se o e-mail chega (Supabase envia por padrão em projetos de desenvolvimento).

- [ ] **Step 3: Commit**
  ```bash
  git add src/app/\(auth\)/reset-password/
  git commit -m "feat: add reset password page with exchangeCodeForSession flow"
  ```

---

## Task 11: Dashboard + layout autenticado + Shell + root redirect

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `src/components/layout/Shell.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Criar src/components/layout/Shell.tsx**

  ```tsx
  import { type ReactNode } from 'react'
  import Link from 'next/link'

  interface ShellProps {
    children: ReactNode
  }

  export function Shell({ children }: ShellProps) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/dashboard" className="font-semibold text-gray-900">
              Med Mind
            </Link>
            <span className="text-xs text-gray-400">Módulo Consultório</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </div>
    )
  }
  ```

- [ ] **Step 2: Criar src/app/(dashboard)/layout.tsx**

  ```tsx
  import { createClient } from '@/lib/supabase/server'
  import { redirect } from 'next/navigation'
  import { Shell } from '@/components/layout/Shell'

  export default async function DashboardLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    return <Shell>{children}</Shell>
  }
  ```

- [ ] **Step 3: Criar src/app/(dashboard)/dashboard/page.tsx**

  ```tsx
  import { createClient } from '@/lib/supabase/server'

  export default async function DashboardPage() {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-500 text-sm">
          Bem-vindo, {user?.email}. O módulo consultório está em construção.
        </p>
      </div>
    )
  }
  ```

- [ ] **Step 4: Atualizar src/app/page.tsx para redirecionar baseado em sessão**

  ```tsx
  import { createClient } from '@/lib/supabase/server'
  import { redirect } from 'next/navigation'

  export default async function RootPage() {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    redirect(user ? '/dashboard' : '/login')
  }
  ```

- [ ] **Step 5: Criar src/utils/.gitkeep** (garante que a pasta utils existe no git)
  ```bash
  New-Item -ItemType File src/utils/.gitkeep
  ```

- [ ] **Step 6: Criar src/lib/ab4/.gitkeep** (garante pasta para sub-projeto 3)
  ```bash
  New-Item -ItemType Directory -Force src/lib/ab4
  New-Item -ItemType File src/lib/ab4/.gitkeep
  ```

- [ ] **Step 7: Verificar fluxo completo no navegador**

  1. `http://localhost:3000` → deve redirecionar para `/login`
  2. Fazer login com usuário cadastrado → deve ir para `/dashboard`
  3. Dashboard deve mostrar e-mail do usuário logado
  4. Tentar `http://localhost:3000/login` estando logado → deve redirecionar para `/dashboard`

- [ ] **Step 8: Rodar testes unitários**
  ```bash
  npm test
  ```
  Esperado: 8 testes passando (redirect.test.ts).

- [ ] **Step 9: Commit**
  ```bash
  git add src/app/\(dashboard\)/ src/components/layout/ src/app/page.tsx src/utils/ src/lib/ab4/
  git commit -m "feat: add dashboard layout, Shell, and root redirect"
  ```

---

## Task 12: API stubs + OpenAI client

**Files:**
- Create: `src/app/api/ai/route.ts`, `src/app/api/ab4/route.ts`, `src/lib/openai/client.ts`
- Create: `src/app/api/ai/route.test.ts`, `src/app/api/ab4/route.test.ts`

- [ ] **Step 1: Instalar OpenAI SDK**
  ```bash
  npm install openai server-only
  ```

- [ ] **Step 2: Escrever testes que vão falhar**

  Criar `src/app/api/ai/route.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest'
  import { GET, POST } from './route'

  describe('GET /api/ai', () => {
    it('retorna 501 Not Implemented', async () => {
      const response = await GET()
      expect(response.status).toBe(501)
      const body = await response.json()
      expect(body.error).toBe('Not implemented')
    })
  })

  describe('POST /api/ai', () => {
    it('retorna 501 Not Implemented', async () => {
      const response = await POST()
      expect(response.status).toBe(501)
      const body = await response.json()
      expect(body.error).toBe('Not implemented')
    })
  })
  ```

  Criar `src/app/api/ab4/route.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest'
  import { GET, POST } from './route'

  describe('GET /api/ab4', () => {
    it('retorna 501 Not Implemented', async () => {
      const response = await GET()
      expect(response.status).toBe(501)
      const body = await response.json()
      expect(body.error).toBe('Not implemented')
    })
  })

  describe('POST /api/ab4', () => {
    it('retorna 501 Not Implemented', async () => {
      const response = await POST()
      expect(response.status).toBe(501)
      const body = await response.json()
      expect(body.error).toBe('Not implemented')
    })
  })
  ```

- [ ] **Step 3: Rodar testes para confirmar que falham**
  ```bash
  npm test
  ```
  Esperado: FAIL — `Cannot find module './route'`

- [ ] **Step 4: Criar src/app/api/ai/route.ts**

  ```ts
  import { NextResponse } from 'next/server'

  export function GET() {
    return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
  }

  export function POST() {
    return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
  }
  ```

- [ ] **Step 5: Criar src/app/api/ab4/route.ts**

  ```ts
  import { NextResponse } from 'next/server'

  export function GET() {
    return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
  }

  export function POST() {
    return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
  }
  ```

- [ ] **Step 6: Rodar testes para confirmar que passam**
  ```bash
  npm test
  ```
  Esperado: 12 testes passando (8 redirect + 4 stubs).

- [ ] **Step 7: Criar src/lib/openai/client.ts**

  ```ts
  import 'server-only'
  import OpenAI from 'openai'

  export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  ```

- [ ] **Step 8: Verificar que o build compila**
  ```bash
  npm run build
  ```
  Esperado: build sem erros.

- [ ] **Step 9: Commit**
  ```bash
  git add src/app/api/ src/lib/openai/
  git commit -m "feat: add API stubs (501) and OpenAI server-only client"
  ```

---

## Task 13: Verificação final + Docker local + deploy Easypanel

**Files:** nenhum novo — verificação e deploy.

- [ ] **Step 1: Rodar todos os testes unitários**
  ```bash
  npm test
  ```
  Esperado: 12 testes passando, nenhum falhando.

- [ ] **Step 2: Rodar build de produção**
  ```bash
  npm run build
  ```
  Esperado: build sem erros, pasta `.next/standalone` presente.

- [ ] **Step 3: Rodar testes E2E** (requer servidor dev rodando)
  ```bash
  npm run test:e2e
  ```
  Esperado: testes Playwright passando (redirect, cadastro, login, redirect de usuário autenticado).

  Se algum teste falhar por timing, investigar — não ignorar.

- [ ] **Step 4: Verificar build Docker local** (requer Docker instalado)
  ```bash
  docker build -t med-mind-consultorio .
  docker run -p 3000:3000 \
    -e NEXT_PUBLIC_SUPABASE_URL=<sua-url> \
    -e NEXT_PUBLIC_SUPABASE_ANON_KEY=<sua-key> \
    -e SUPABASE_SERVICE_ROLE_KEY=<sua-key> \
    -e OPENAI_API_KEY=<sua-key> \
    med-mind-consultorio
  ```
  Abrir `http://localhost:3000`. Esperado: app funciona dentro do container.

  Parar o container com `Ctrl+C` ou `docker stop <id>`.

- [ ] **Step 5: Push final para GitHub**
  ```bash
  git push origin main
  ```

- [ ] **Step 6: Configurar Easypanel**

  1. Abrir Easypanel → Create App → GitHub → selecionar `med-mind-consultorio`
  2. Build method: Dockerfile
  3. Port: 3000
  4. Em Environment Variables, adicionar:
     ```
     NEXT_PUBLIC_SUPABASE_URL=<valor>
     NEXT_PUBLIC_SUPABASE_ANON_KEY=<valor>
     SUPABASE_SERVICE_ROLE_KEY=<valor>
     OPENAI_API_KEY=<valor>
     ```
  5. Deploy

- [ ] **Step 7: Verificar deploy no Easypanel**

  Acessar a URL gerada pelo Easypanel. Esperado:
  - `/` redireciona para `/login`
  - Login funciona com usuário já cadastrado
  - Dashboard carrega corretamente

- [ ] **Step 8: Verificar checklist final do spec**

  Confirmar cada item do Section 10 do spec `docs/superpowers/specs/2026-05-28-foundation-design.md`:

  - [ ] Repositório GitHub criado com `.gitignore` incluindo `.env.local`
  - [ ] Repositório conectado ao Easypanel
  - [ ] Next.js 15 + TypeScript + Tailwind configurados
  - [ ] `next.config.ts` com `output: 'standalone'`
  - [ ] Dockerfile funcional com `ENV HOSTNAME=0.0.0.0`
  - [ ] Variáveis de ambiente documentadas em `.env.example`
  - [ ] Supabase conectado (cliente browser e servidor separados)
  - [ ] Migration `0001_create_profiles.sql` aplicada via Supabase CLI
  - [ ] Tabela `profiles` com constraints, RLS, GRANTs e triggers
  - [ ] Fluxo de cadastro funcional
  - [ ] Fluxo de login funcional
  - [ ] Fluxo de recuperação de senha funcional
  - [ ] Middleware com `getUser()`, não `getSession()`
  - [ ] Dashboard placeholder acessível após login em `/dashboard`
  - [ ] Stubs `api/ai/route.ts` e `api/ab4/route.ts` retornando 501
  - [ ] Tipos TypeScript gerados via Supabase CLI
  - [ ] Deploy no Easypanel funcionando a partir do GitHub
