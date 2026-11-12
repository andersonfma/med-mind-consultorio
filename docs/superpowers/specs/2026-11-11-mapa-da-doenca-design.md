# Mapa da Doença — design

**Data:** 2026-11-11
**Status:** aprovado em brainstorming; pendente revisão da spec → plano de implementação
**Nome de trabalho:** "Mapa da Doença" (ajustável)

## 1. Contexto e premissa

A tese pedagógica do fundador: **quem entende a fisiopatogênese entende a clínica, faz o diagnóstico e trata.** O recurso traduz essa premissa em produto — um gerador que, a partir do nome de uma doença, produz um resumo **centrado no mecanismo**, correlacionando fisiopatogênese ↔ clínica, ↔ diagnóstico e ↔ tratamento.

É coerente com a alma da Med Mind ("entender, não decorar"; método AB4 avalia *como* se pensou). Diferencia de "mais um gerador de resumo": o valor não é o texto, é a **correlação causal explícita**.

## 2. Decisões já tomadas (brainstorming)

- **Formato:** mapa visual (herói) + texto mecanístico curto. Ambos derivam do mesmo objeto estruturado.
- **Entrada (v1):** busca livre — o aluno digita a doença/tema e gera.
- **Acesso:** **1 mapa grátis** de degustação; depois **Premium**.
- **Persistência:** cada mapa salvo é o primeiro tijolo da **biblioteca virtual** (roadmap).

## 3. O coração: o objeto de correlação

A geração NÃO devolve texto solto. Devolve um objeto estruturado (saída estruturada da IA), em que cada achado/exame/conduta carrega seu **"porquê" mecanístico**. Essa amarração item ↔ mecanismo é o pulo do gato; dela saem o mapa e o texto.

Formato lógico (schema a detalhar no plano):

```
DiseaseMap {
  disease:        string            // nome normalizado
  area:           string            // área clínica (das 9 já cobertas)
  core: [                           // núcleo fisiopatológico — 1 a 3 mecanismos-chave
    { mechanism: string, detail: string }
  ]
  clinica: [                        // cada achado amarrado ao mecanismo
    { finding: string, because: string }   // because referencia o mecanismo
  ]
  diagnostico: [
    { test: string, because: string }       // o que o mecanismo faz aparecer no exame
  ]
  tratamento: [
    { approach: string, because: string }    // que ponto do mecanismo a conduta ataca
  ]
  summary:        string            // texto mecanístico curto (derivado, encadeia mecanismo→clínica→dx→tto)
  disclaimer:     string            // fixo: material de estudo, não conduta
}
```

Princípios do conteúdo:
- **Mecanismo primeiro.** `core` é a origem; `clinica/diagnostico/tratamento` são consequências que *apontam de volta* para o `core`.
- `because` é obrigatório em cada item — é o que força a correlação (sem ele, vira lista plana e perde o propósito).
- Tratamento explica **por que a classe/estratégia funciona** (qual elo do mecanismo ela quebra), **sem doses nem prescrição detalhada** (guard-rail).

## 4. Geração (IA)

- Reutiliza a infra de geração já existente no app (mesmo provedor/cliente de IA usado nos simulados/consultas).
- **Saída estruturada** (JSON validado contra o schema) para garantir o formato e as amarrações.
- **Escopo:** restrito às áreas clínicas já cobertas pela plataforma. Entradas fora de escopo (não-doença, fora da clínica médica) retornam uma mensagem amigável, não um mapa inventado.
- **Prompt (intenção):** instrui o modelo a partir do(s) mecanismo(s) central(is) e derivar cada achado/exame/conduta explicitando o elo mecanístico; nível "estudante de medicina"; conciso; pt-BR.
- **Normalização da entrada:** sinônimos/variações mapeiam para a mesma doença quando possível (ex.: "IC" → "Insuficiência cardíaca").

## 5. Experiência (fluxo v1)

1. Aluno acessa o recurso (entrada no menu/área de estudo) e vê um **campo de busca** com exemplos/sugestões.
2. Digita a doença → "Gerar".
3. Tela de geração (curta) → resultado:
   - **Mapa de correlação** (herói): núcleo no centro; três ramos (clínica / diagnóstico / tratamento); cada folha mostra o achado + seu "porquê".
   - **Texto mecanístico curto** abaixo.
4. Ações: **Salvar** (entra na biblioteca do aluno) e **Compartilhar** (card, no padrão social já existente).

## 6. Visual do mapa

- Família visual do **card de estudo** e da identidade (Ink × Elétrico).
- Núcleo em destaque; ramos rotulados Clínica / Diagnóstico / Tratamento; cada folha com micro-"porquê".
- Responsivo; legível em tema claro e escuro.
- O desenho detalhado do mapa é um passo seguinte (após a spec), não bloqueia a modelagem.

## 7. Persistência e biblioteca

- Nova tabela para mapas salvos do aluno (ex.: `disease_maps`), com RLS por usuário; guarda o objeto estruturado (JSON) + metadados (doença, área, data).
- É a **fundação da biblioteca virtual**: v1 entrega a geração + salvar + listar os próprios mapas. A biblioteca completa (coleções, grifos, notas) é incremento posterior.

## 8. Acesso e cobrança (1 grátis → Premium)

- Reutiliza o mecanismo de limite do plano grátis já existente (contagem de uso / RPC de consumo).
- **Grátis:** 1 mapa (lifetime, degustação). **Premium:** ilimitado.
- Ao atingir o limite grátis, CTA para `/premium` (upsell) no padrão atual.

## 9. Guard-rails

- Selo fixo "material de estudo — não é conduta clínica" (padrão do app).
- Escopo clínico restrito; sem doses/prescrição; foco em mecanismo e correlação.
- Entrada inválida/fora de escopo → mensagem clara, sem alucinar mapa.

## 10. Fora de escopo (v1)

- Gatilho pós-caso/desafio ("gerar o mapa dessa doença") — fast-follow.
- Toggle de profundidade (estudante ↔ residência).
- Biblioteca completa (coleções, notas, grifos, revisão espaçada).
- Edição manual do mapa pelo aluno.

## 11. Critérios de sucesso (v1)

- Aluno digita uma doença e recebe um mapa com correlações mecanismo↔consequência corretas e úteis, + texto curto.
- Todo item traz seu "porquê" (nenhuma lista plana).
- 1 grátis depois Premium funcionando; mapa salvável e recuperável; compartilhável.
- Conteúdo com o selo de estudo; fora de escopo tratado com elegância.
