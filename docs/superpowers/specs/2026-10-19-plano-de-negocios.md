# Med Mind — Plano de Negócios

Data: 2026-10-19
Status: rascunho estratégico para revisão (não é spec de implementação).
Natureza: documento vivo — base para decidir o modelo de cobrança antes de codar checkout.

## 1. O produto, em uma frase

Med Mind é o **simulador de raciocínio clínico com IA + a rede social dos estudantes de
medicina**: o aluno atende pacientes virtuais, recebe avaliação objetiva do seu raciocínio e
comunicação, e vive isso dentro de uma comunidade com feed, stories, desafio semanal e ranking.

Dois ativos que se reforçam:
- **Simulador** (valor pedagógico): consultas com IA, método AB4, 9 especialidades, avaliação de
  raciocínio e comunicação, flashcards, seletor de doença, prescrição/conduta.
- **Rede social** (valor de engajamento/distribuição): feed, stories (foto/vídeo), seguir,
  curtir, comentar, dúvidas, resenhas; desafio da semana (caso de Clínica Médica em 5 dias, 1
  quiz/dia) com **aposta de MedCoin** e ranking; compartilhamento externo com página pública e
  CTA de cadastro; notificações in-app e push.

A tese: **o simulador entrega o valor; a rede social distribui e retém**. Treinar deixa de ser
solitário — vira hábito social e competitivo.

## 2. Mercado e público

- **Alvo primário (B2C):** estudantes de medicina do Brasil — do ciclo básico ao internato, e
  candidatos à residência. Dor: insegurança clínica, poucas oportunidades de praticar a consulta
  com segurança antes do paciente real; estudo isolado e pouco engajante.
- **Alvo secundário (B2B, fase 2):** faculdades, ligas acadêmicas e cursinhos de residência —
  que precisam de treino padronizado e acompanhamento de turma (o `/admin` com indicadores
  pedagógicos já existe).
- Casos clínicos são **simulados** (sem dado de paciente real) — reduz risco regulatório/ético
  no conteúdo; o dado sensível introduzido pela rede é só a identidade opcional do estudante.

## 3. Estratégia central: B2C como motor

O cliente que sustenta o negócio é **o aluno** (assinatura individual). A rede social e o desafio
diário são o **motor de aquisição e retenção** — não um fim em si:
- **Aquisição viral:** cada card de resultado/stories compartilhado leva a uma página pública com
  "Criar conta grátis" (loop de convite embutido no produto).
- **Retenção por hábito:** desafio diário + streak + ranking + notificações trazem o aluno de
  volta todo dia.
- **Conversão:** quem engaja no grátis encontra limites naturais (volume, profundidade) e assina.

Métrica-norte: **assinantes ativos** (MRR). Métricas de apoio: cadastros vindos de
compartilhamento (viralidade), DAU/retorno D1 (hábito), e taxa grátis→pago (conversão).

## 4. Modelo de receita B2C — Freemium + assinatura

### 4.1 Linha do grátis (decisão do fundador: generosa, pró-viral)
**Grátis para sempre** — tudo que atrai e engaja:
- **Rede social completa**: feed, stories (foto e **vídeo** — vídeo no story é livre),
  seguir/curtir/comentar, postar dúvidas e resenhas.
- **Desafio da semana + quiz diário + MedCoin + ranking**: o gancho de hábito, 100% grátis.
- **Simulador com limite mensal de consultas** (ex.: 5–10/mês) — suficiente para provar o valor.
- **Compartilhar resultados**: card e página pública com CTA — é aquisição, fica grátis.

### 4.2 O que o Premium vende (profundidade e conveniência, "acima" da linha grátis)
O premium **não** cobra acesso básico; cobra por tirar limites e aprofundar:
- **Consultas ilimitadas** no simulador (acima do teto do grátis) + histórico longitudinal completo.
- **Vídeo no feed** (post de vídeo) — gate premium candidato, **adiado** (story de vídeo livre).
- **Recursos avançados candidatos** (a validar): relatórios de evolução (radar AB4 ao longo do
  tempo, pontos fracos), modos/especialidades extras ou casos "hard" ilimitados, flashcards/
  banco de estudo dirigido, destaque de perfil, **selo ✦ Premium**.
- **Simulados ENAMED/ENARE por IA** (recurso do ecossistema, premium): simulados gerados por IA
  "nos moldes" das provas (análise de estrutura/temas → questões ORIGINAIS) + **relatório de
  tendências**. Diferencial = fidelidade à estrutura real da prova. SEM reprodução de questões
  reais verbatim (direito autoral do INEP/ENARE) — provas reais só como insumo de análise.
  Requer design curto + entender o formato real das provas antes de codar.
- **Regra anti-pay-to-win:** o premium NÃO compra posição no ranking nem MedCoin de aposta —
  ranking e desafio seguem meritocráticos. Premium é profundidade pedagógica + conveniência +
  status, nunca vantagem competitiva no jogo.

### 4.3 Preço (hipótese a validar, não fixada)
- Mensal e **anual com desconto** (ancora retenção e caixa).
- Faixa de referência do segmento estudantil BR: assinatura mensal de "preço de um lanche"
  (validar com pesquisa/teste de preço). Oferecer plano anual ~2 meses grátis.
- **Trial** ou "primeiro mês promocional" para reduzir atrito de conversão.

## 5. Frente B2B — Fase 2 (futuro, pós-tração B2C)

Ativada quando o B2C tiver massa e prova social (depoimentos, uso, ranking ativo):
- **Licença por turma/aluno**: faculdade/liga/cursinho paga por X alunos por semestre.
- **Entregável institucional:** o **painel do coordenador** (já existe) — KPIs de engajamento,
  coerência de exames, adequação de conduta, fechamento de diagnóstico, ficha por aluno,
  bloqueio/moderação. É o diferencial de venda para quem ensina.
- **Vantagem de usar o B2C como base:** o produto já está validado e cheio de alunos; vender para
  a instituição é "traga sua turma para onde seus alunos já estão". Ciclo de venda mais longo,
  ticket maior, receita previsível — complementa o B2C sem ser o motor.
- Possíveis formatos: licença anual por turma; piloto gratuito por um semestre para ligas (porta
  de entrada); co-marketing com ligas (elas trazem alunos, ganham status).

## 6. O que a "cobrança" envolve (quando chegarmos lá)

Independe de ser simulador, rede ou os dois — é uma **camada** sobre o produto:
- **Provedor de pagamento:** cartão/assinatura internacional (Stripe) e/ou **Pix recorrente** via
  gateway BR (Asaas, Pagar.me, Iugu) — o público BR usa muito Pix; avaliar os dois.
- **Checkout** (hospedado pelo provedor, menos risco PCI) + **webhook** que escuta eventos
  (assinou, renovou, pagamento falhou, cancelou, reembolso).
- **Estado de assinatura no perfil** (`subscription_status`, `plan`, `current_period_end`) que
  **destrava os gates** (hoje implementaríamos primeiro só a flag manual `is_premium`).
- **Gestão:** portal do cliente (trocar cartão, cancelar), dunning (cobrança falha → aviso),
  emissão de recibo/nota (a avaliar conforme regime).
- **Decisão de produto embutida:** o que entra em cada plano (seção 4.2) precisa estar fechado
  ANTES de modelar o checkout — senão o gate vira retrabalho.

### Caminho incremental sugerido (reduz risco)
1. **Selo premium manual** (`is_premium` + botão no /admin) + **gate de vídeo só no feed**. Zero
   pagamento; valida se o recurso premium tem demanda. **(próximo passo de código, pós-plano.)**
2. **Validar a linha grátis/pago** com usuários reais (quais limites incomodam, o que querem pagar).
3. **Integrar pagamento** (fatia própria): provedor + checkout + webhook + estado de assinatura.
4. **B2B** (fatia própria): licenciamento por turma sobre o painel do coordenador.

## 7. Riscos e mitigações
- **Linha grátis generosa demais → baixa conversão.** Mitigar: limites de volume (consultas/mês)
  e profundidade (relatórios/ilimitado) bem posicionados; medir conversão e ajustar.
- **Ranking/aposta premium = pay-to-win → perda de confiança.** Mitigar: regra firme — premium
  nunca compra vantagem competitiva (seção 4.2).
- **Rede vazia/estudante sozinho → sem efeito viral.** Mitigar: desafio diário dá conteúdo mesmo
  com rede pequena; semear com ligas/turmas iniciais.
- **Dependência de IA (custo por consulta).** O limite grátis de consultas também protege o custo
  de inferência; premium (ilimitado) precisa de preço que cubra o uso médio.
- **Pagamento/impostos BR.** Pix recorrente e emissão fiscal têm particularidades; resolver na
  fatia de pagamento com contador/consultoria.

## 8. Decisões em aberto (para as próximas conversas)
- Preço exato (mensal/anual) e teto de consultas do grátis.
- Lista final de recursos premium (seção 4.2) — quais de fato gateiam.
- Provedor de pagamento (Stripe vs gateway Pix BR vs ambos).
- Gatilho de início do B2B (que métrica de tração destrava a fase 2).
- Nome/posicionamento do plano pago (ex.: "Med Mind Pro") e do selo.

## 9. Visão futura (roadmap) — Modo Gestor da clínica

Ideia registrada para **fase futura**, não para construir agora. Um modo de gestão estilo
tycoon / "FIFA Manager" em que o médico administra a clínica como negócio: **caixa da clínica**,
**despesas recorrentes** (secretária, aluguel de sala, marketing), **classificados** para
contratar secretárias e um **mercado de salas** (alugar/comprar) para atender. A economia é movida
pelo desempenho real no simulador — **preço das consultas e reputação do médico geram receita**;
a reputação destrava salas melhores e pacientes mais exigentes.

- **Potencial estratégico:** vira o **meta-jogo** que dá propósito econômico às consultas e
  **unifica o MedCoin** (hoje restrito à aposta no quiz); pode ser um motor premium mais rico que
  um selo.
- **Requisitos antes de construir:** (1) spec próprio com **economia balanceada**
  (receita/custos/progressão, evitar grind e evitar trivial); (2) preservar a regra
  **anti-pay-to-win** — dinheiro real nunca compra reputação, ranking ou vantagem competitiva, só
  conveniência/cosmético; (3) só após **validar a conversão premium** do loop atual.
- **Gatilho para iniciar:** premium validado + tração de retenção. Quando chegar a hora, passa
  pelo brainstorming → spec antes de qualquer código.

## 10. Próximo passo acordado
Revisar este plano. Em seguida, implementar o **selo premium manual** (flag `is_premium` + botão
no /admin), **sem cobrança e sem gate de vídeo por ora** — apenas para marcar quem é premium e
validar a demanda. O gate de vídeo no feed fica adiado (fundador tirou do escopo imediato). Só
depois desenhar a fatia de pagamento já alinhada a esta estratégia.
