# Camada social/competitiva v1 — Ranking (XP) + Card compartilhável

Data: 2026-10-06
Objetivo de negócio: PLG/viralidade (1) + retenção (2). Manter o simulador como
produto; adicionar uma camada que amplifica e viraliza. Tudo sobre casos
SIMULADOS (sem dado clínico real → sem risco de privacidade).

Fora de escopo (YAGNI): grafo de amigos, "pedir parecer", live/feed,
conquistas/níveis, notificações. (Níveis saem do XP depois.)

## 1. Modelo de pontos (XP)
Pontos por CONSULTA FINALIZADA (arco diagnóstico):

    pontos = round(peso_dificuldade × fator_qualidade) + bonus_alcancado
      peso:   easy 10 · medium 20 · hard 35
      fator:  0,5 + (ab4.overall / 20)        // 0,5 (nota 0) → 1,0 (nota 10)
      bonus:  +15 quando diagnosis_status vira 'achieved' (raciocínio bateu)

- Sem AB4 (avaliação indisponível / sem pensamento clínico) → fator mínimo 0,5.
- NÃO retroativo: só consultas finalizadas a partir do deploy.
- Fonte única: `consultations.points` (gravado no finish). O bônus "alcançado"
  é somado no reveal-diagnosis (quando status vira 'achieved'), atualizando a
  linha da consulta mais recente finalizada do paciente.
- Ranking = soma de `consultations.points` por usuário (semanal e geral),
  calculada por query. Sem total duplicado em profiles (evita dessincronizar).

## 2. Ranking (retenção)
- Página `/ranking` (dentro do Shell do dashboard). Abas: "Semana" (finished_at
  na semana corrente, seg–dom) e "Geral".
- Top 50: posição, nome/apelido OU "Anônimo", XP, nº de casos. A linha do
  próprio usuário é SEMPRE destacada e fixada se estiver fora do top 50.
- Identidade OPT-IN: por padrão o aluno aparece como "Anônimo" (vê a própria
  posição e a dos outros). Ao optar, escolhe `leaderboard_alias` (nome ou
  apelido) e passa a figurar com ele.
- Link "Ranking" no header (Shell), visível para todos.

## 3. Card compartilhável (viralidade)
- Rota pública `GET /api/share/[consultationId]` → imagem PNG (next/og
  ImageResponse, mesma tecnologia do opengraph-image). Mostra: marca Med Mind,
  "Resolvi: <diagnóstico>" (se revelado; senão "Caso de <especialidade>"),
  Raciocínio X/10, dificuldade, pontos ganhos, e app.medmindedu.com.br.
- Só renderiza campos SIMULADOS e não-sensíveis. SEM nome do aluno (default).
  Exige consulta 'finished' (evita vazar caso em andamento). UUID aleatório
  mitiga enumeração. Rota liberada no proxy (como /opengraph-image).
- Botão "Compartilhar" no FinishModal (após concluir): usa Web Share API
  (navigator.share) no mobile → WhatsApp/Insta; fallback desktop: abrir imagem
  em nova aba + copiar link.

## 4. Dados (migrações)
- `ALTER TABLE consultations ADD COLUMN points INTEGER NOT NULL DEFAULT 0;`
  + índice `(user_id, finished_at)` para o ranking.
- `ALTER TABLE profiles ADD COLUMN leaderboard_optin BOOLEAN NOT NULL DEFAULT false;`
- `ALTER TABLE profiles ADD COLUMN leaderboard_alias TEXT;`
- Migrações aplicadas via SQL Editor do Supabase. Código resiliente se a coluna
  faltar (best-effort no write de points, como fizemos no flashcard).

## 5. Testes
- `lib/.../points.ts`: fórmula (tabela de casos: dificuldade × nota × alcançado).
- Ranking: query de soma semanal/geral + destaque do usuário.
- Card: rota renderiza 200/PNG; esconde diagnóstico se não revelado.
- Opt-in: alias aparece só quando optin=true.

## 6. Entrega
Deploy via webhook do Easypanel (curl na URL de gatilho). Migrações via SQL
Editor (Supabase) — eu aplico.
