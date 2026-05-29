# Med Mind — Módulo Consultório
# Sub-projeto 0: Fundação
# Design Spec

Data: 2026-05-28
Revisado após code review: 2026-05-28

---

## 1. Contexto e objetivo

O Med Mind — Módulo Consultório é um simulador gamificado de consultório clínico
para estudantes de medicina e médicos recém-formados. O diferencial proprietário
é o método AB4 de pensamento clínico (Anderson-Brito), que avalia o movimento
do raciocínio — não apenas se o aluno acertou o diagnóstico.

O produto opera em modelo B2C (aluno individual) e B2B (faculdades de medicina).

Este spec cobre exclusivamente o sub-projeto 0 — a Fundação. Nenhuma lógica de
negócio (pacientes, consultas, AB4, MedCoin) é implementada aqui. A Fundação
entrega: projeto configurado, autenticado, deployado e com schema inicial.

---

## 2. Stack

| Camada       | Tecnologia                              |
|--------------|-----------------------------------------|
| Framework    | Next.js 15 (App Router) + TypeScript    |
| Estilo       | Tailwind CSS puro (sem biblioteca UI)   |
| Banco + Auth | Supabase (PostgreSQL + RLS + Auth)      |
| IA           | OpenAI API (server-side exclusivo)      |
| Deploy       | Docker + Easypanel                      |
| Repositório  | GitHub                                  |

### Decisões importantes

- **Sem biblioteca de componentes** (shadcn, MUI, etc.) — o produto tem
  identidade visual própria. Componentes serão construídos sob medida com
  Tailwind.
- **OpenAI só no servidor** — nenhuma chave de API é exposta ao browser.
  Todas as chamadas passam por API routes do Next.js. `lib/openai/client.ts`
  deve importar `'server-only'` na primeira linha para causar erro de build
  se acidentalmente importado em componente client-side.
- **Supabase RLS ativo desde o início** — cada aluno só acessa seus próprios
  dados por política de banco, sem lógica de permissão manual no código.
- **Versão do `@supabase/ssr` deve ser fixada** no `package.json` — o pacote
  teve breaking changes entre minor versions em relação ao uso de `cookies()`
  no App Router. Usar a versão mais recente estável no momento da implementação
  e não atualizar sem testar o fluxo de auth completo.

---

## 3. Estrutura de pastas

```
src/
├── app/
│   ├── (auth)/                  # rotas públicas (sem layout autenticado)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── reset-password/      # recuperação de senha (incluída na Fundação)
│   │       └── page.tsx
│   ├── (dashboard)/             # rotas autenticadas — URL raiz é /dashboard
│   │   ├── layout.tsx           # verifica sessão; redireciona se ausente
│   │   └── dashboard/
│   │       └── page.tsx         # dashboard inicial (placeholder)
│   └── api/
│       ├── ai/                  # chamadas OpenAI (sub-projeto 2+)
│       │   └── route.ts         # stub: retorna 501 Not Implemented
│       └── ab4/                 # avaliação AB4 (sub-projeto 3)
│           └── route.ts         # stub: retorna 501 Not Implemented
├── components/
│   ├── ui/                      # átomos reutilizáveis (Button, Input, Card)
│   └── layout/                  # Shell, Nav, Sidebar
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # cliente browser (createBrowserClient)
│   │   └── server.ts            # cliente server (createServerClient + cookies)
│   ├── openai/
│   │   └── client.ts            # instância OpenAI — importa 'server-only'
│   └── ab4/                     # motor AB4 — cresce no sub-projeto 3
├── types/
│   ├── database.ts              # gerado via: supabase gen types typescript --linked
│   └── domain.ts                # tipos de domínio; Role importa de database.ts
├── utils/                       # helpers gerais
└── middleware.ts                # proteção de rotas autenticadas
```

### Regra de clientes Supabase

`lib/supabase/client.ts` usa `createBrowserClient` — para componentes client-side.
`lib/supabase/server.ts` usa `createServerClient` com `cookies()` do Next.js —
para Server Components, Server Actions e API routes. Misturar os dois causa bugs
silenciosos de sessão.

### Pastas criadas na Fundação vs. futuro

As pastas `patients/` e `consultations/` dentro de `(dashboard)/` **não são
criadas na Fundação** — aparecem aqui apenas como referência de onde viverão
nos sub-projetos 1 e 2. As pastas `api/ai/` e `api/ab4/` **são criadas na
Fundação** como stubs que retornam `501 Not Implemented`, garantindo que as
rotas existam e sejam testáveis desde o início.

### Geração de tipos TypeScript

```bash
supabase gen types typescript --linked > src/types/database.ts
```

Rodar esse comando sempre que o schema Supabase mudar. O tipo `Role` em
`domain.ts` deve importar do tipo gerado em `database.ts` — não redeclarar
a union manualmente.

---

## 4. Schema do banco (Fundação)

### Schema aplicado via migrations Supabase CLI

O schema deve ser versionado como migration, não aplicado manualmente pelo
dashboard. Arquivo: `supabase/migrations/0001_create_profiles.sql`.

Usar o Supabase CLI:
```bash
supabase migration new create_profiles
# editar o arquivo gerado em supabase/migrations/
supabase migration up   # aplica apenas as migrations pendentes no remote
# Nota: evitar `supabase db push` quando o banco já tiver dados —
# db push faz diff do schema local e pode ser destrutivo.
```

### Tabela `profiles`

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

### Esboço das tabelas futuras (referência para próximos specs)

| Tabela             | Sub-projeto | Responsabilidade                               |
|--------------------|-------------|------------------------------------------------|
| `patients`         | 1           | Carteira de pacientes do aluno                 |
| `consultations`    | 2           | Registro de cada consulta                      |
| `exam_orders`      | 2           | Exames solicitados + justificativa obrigatória |
| `prescriptions`    | 2           | Medicamentos prescritos por consulta           |
| `ab4_evaluations`  | 3           | Scores A1–A4 por consulta                      |
| `clinic_stats`     | 5           | MedCoin, receita fictícia, custos              |
| `institutions`     | B2B futuro  | Faculdades e organizações B2B                  |

**Nota sobre `exam_orders`:** o campo `justification` (texto do aluno) é
obrigatório. A API valida se a justificativa responde a uma pergunta clínica
coerente antes de liberar o exame. Justificativas inválidas retornam ao aluno
para reformulação e alimentam o eixo A3 do AB4.

**Nota sobre B2B institucional:** a tabela `institutions` e uma possível coluna
`institution_id` em `profiles` são decisão pendente a ser tomada antes do
sub-projeto B2B. Adicionar `institution_id` depois exige migration em tabela
com dados. Essa decisão deve ser tomada no spec do sub-projeto B2B — não ignorar.

**Nota sobre dependência MedCoin:** o sub-projeto 5 (Gestão/MedCoin) está
posicionado após o 4 (Longitudinalidade) porque MedCoin acompanha a evolução
clínica ao longo do tempo, não apenas consultas individuais. Se durante o
sub-projeto 4 ficar claro que MedCoin pode existir sem longitudinalidade, a
ordem pode ser revisada no spec correspondente.

---

## 5. Fluxo de autenticação

### Cadastro

1. Aluno preenche: nome completo, e-mail, senha, CRM (opcional), papel
   (estudante / residente / médico).
2. `supabase.auth.signUp()` cria usuário em `auth.users` com metadados
   `full_name` e `role`.
3. Trigger `on_auth_user_created` cria linha em `profiles` automaticamente.
   Se `full_name` estiver vazio, o trigger lança exceção e o `signUp()` retorna
   erro ao cliente.
4. Redireciona para `/dashboard`.

### Login

1. Aluno preenche e-mail e senha.
2. `supabase.auth.signInWithPassword()` valida credenciais.
3. Supabase define cookie de sessão HTTP-only.
4. Redireciona para `/dashboard`.

### Recuperação de senha

Incluída na Fundação (2h de implementação, evita incidente de suporte imediato):

1. Aluno clica em "Esqueci minha senha" na tela de login.
2. `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`
   envia e-mail via Supabase.
3. Aluno clica no link → chega em `/reset-password?code=<token>`.
4. A página chama `supabase.auth.exchangeCodeForSession(code)` para estabelecer
   a sessão a partir do token da URL. **Esta etapa é obrigatória** — sem ela,
   `updateUser` falhará com "Auth session missing".
5. Com sessão estabelecida: `supabase.auth.updateUser({ password: novasenha })`.
6. Redireciona para `/dashboard`.

### Proteção de rotas — middleware

`src/middleware.ts` usa o padrão oficial `@supabase/ssr` com `updateSession()`.

Regras críticas de implementação:
- Usar `supabase.auth.getUser()` (validação server-side), **nunca** `getSession()`
  (confia no JWT do cliente sem validar no servidor — anti-pattern documentado
  pelo Supabase).
- O middleware deve reescrever cookies de sessão em toda requisição para manter
  a sessão atualizada (`updateSession` faz isso automaticamente).

Configuração do matcher (URL real, não nome do route group):

```ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|register|reset-password).*)',
  ],
}
```

Comportamento:
- Rota sem sessão válida → redireciona para `/login`
- Rota `/login` ou `/register` com sessão válida → redireciona para `/dashboard`

### Fora do MVP de autenticação

- OAuth (Google, Apple)
- 2FA
- Convite institucional (B2B — sub-projeto futuro)

---

## 6. Fluxo de consulta (referência para sub-projeto 2)

Registrado aqui para garantir que a Fundação não bloqueie o design futuro.

```
Anamnese (chat texto ou áudio)
  → Exame físico (gerado pelo sistema)
  → Pedido de exames (justificativa obrigatória por exame)
  → Prescrições
  → Impressão diagnóstica + Conduta
  → Encerrar consulta
  → Avaliação AB4 (lê toda a consulta, incluindo justificativas de exames)
  → Feedback do preceptor simulado
```

### Áudio (sub-projeto 2)

- **Entrada do aluno:** microfone → OpenAI Whisper → transcrição → fluxo normal
- **Saída do paciente:** texto da IA → OpenAI TTS → áudio no browser
- **Modo áudio é opcional** — o aluno escolhe por toggle a cada consulta
- Cada paciente terá uma voz consistente (parâmetro salvo em `patients`)
- O banco armazena sempre texto; áudio é camada de I/O, não de persistência

---

## 7. Deploy

### Configuração do Next.js para Docker

`next.config.ts` mínimo para a Fundação:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // images.remotePatterns: adicionar quando houver avatares ou imagens externas
  // serverExternalPackages: adicionar se OpenAI SDK não buildar corretamente
}

export default nextConfig
```

O arquivo cresce nos sub-projetos seguintes. Não adicionar configurações
antecipadas que não são necessárias agora.

### Dockerfile

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

**`ENV HOSTNAME=0.0.0.0` é obrigatório.** Sem ele, o servidor Next.js standalone
faz bind em `127.0.0.1` e é inacessível fora do container — o Easypanel recebe
conexão recusada e o deploy falha silenciosamente.

### Variáveis de ambiente

Configuradas no Easypanel (nunca em `.env` ou `.env.local` commitado):

```
NEXT_PUBLIC_SUPABASE_URL=        # exposta ao browser — segura
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # exposta ao browser — segura (RLS protege os dados)
SUPABASE_SERVICE_ROLE_KEY=       # server-only — nunca expor ao browser
OPENAI_API_KEY=                  # server-only — nunca expor ao browser
```

### `.env.example` commitado no repositório

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
```

`.env.local` deve estar no `.gitignore` — verificar na criação do projeto.

---

## 8. O que está fora do escopo desta Fundação

- Lógica de pacientes, consultas, exames, prescrições
- Motor AB4
- MedCoin e gestão de consultório
- Gamificação e progressão
- Casos clínicos simulados
- Integração com HepatoMind ou outras verticais
- Ranking e features B2B institucionais
- OAuth, 2FA

---

## 9. Decomposição de sub-projetos (visão geral)

| #       | Sub-projeto                            | Depende de |
|---------|----------------------------------------|------------|
| 0       | Fundação (este spec)                   | —          |
| 1       | Carteira de pacientes                  | 0          |
| 2       | Fluxo de primeira consulta (+ áudio)   | 1          |
| 3       | Avaliação AB4                          | 2          |
| 4       | Longitudinalidade                      | 3          |
| 5       | Gestão e MedCoin                       | 4 (revisar)|
| 6       | Progressão e gamificação               | 5          |
| B2B     | Features institucionais                | 6          |

Cada sub-projeto terá seu próprio spec antes de qualquer código.

---

## 10. Critérios de conclusão da Fundação

A Fundação está completa quando:

- [ ] Repositório GitHub criado com `.gitignore` incluindo `.env.local`
- [ ] Repositório conectado ao Easypanel
- [ ] Next.js 15 + TypeScript + Tailwind configurados
- [ ] `next.config.ts` com `output: 'standalone'`
- [ ] Dockerfile funcional com `ENV HOSTNAME=0.0.0.0` — build e start sem erros
- [ ] Variáveis de ambiente documentadas em `.env.example`
- [ ] Supabase conectado (cliente browser e servidor separados)
- [ ] Migration `0001_create_profiles.sql` aplicada via Supabase CLI
- [ ] Tabela `profiles` com CHECK constraints, RLS (INSERT + SELECT + UPDATE),
      GRANTs, trigger `updated_at` e trigger `handle_new_user`
- [ ] Fluxo de cadastro funcional (cria perfil; erro se `full_name` vazio)
- [ ] Fluxo de login funcional
- [ ] Fluxo de recuperação de senha funcional
- [ ] Middleware protegendo rotas — usando `getUser()`, não `getSession()`
- [ ] Dashboard placeholder acessível após login em `/dashboard`
- [ ] Stubs `api/ai/route.ts` e `api/ab4/route.ts` retornando 501
- [ ] Tipos TypeScript gerados via `supabase gen types typescript --linked`
- [ ] Deploy no Easypanel funcionando a partir do GitHub
