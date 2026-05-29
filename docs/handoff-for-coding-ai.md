# Handoff Para Outra IA De Codigo

Atualizado em: 2026-05-21

Projeto local:

```text
C:\Users\ander\OneDrive\Documentos\Consultóio Vivo
```

Nome de produto atual:

```text
Med Mind - Modulo Consultorio
```

Observacao: o nome antigo "Consultorio Vivo" ainda aparece em alguns nomes de
pasta, chave local ou pacote. Nao renomear tudo mecanicamente sem necessidade.
Na interface e documentacao de produto, preferir "Med Mind - Modulo Consultorio".

## Resumo Executivo

O Med Mind - Modulo Consultorio e um SaaS educacional em prototipagem para
simular consultas ambulatoriais, inicialmente em hepatologia. O publico-alvo sao
alunos de medicina e medicos que desejam treinar atendimento, raciocinio
clinico, tecnica, comunicacao e gestao de consultorio. Ha potencial B2C e B2B
para faculdades de medicina.

O diferencial proprietario e incorporar o metodo AB4 de pensamento clinico,
sobretudo em pacientes de primeira vez. O AB4 avalia o movimento do raciocinio,
nao apenas se o aluno acertou o diagnostico.

O produto nasceu paralelo ao HepatoMind, mas deve ser tratado como produto
proprio da Med Mind, integravel a outras verticais por contrato de dados, sem
dependencia direta.

## Premissas De Produto

- O sistema e uma simulacao educacional, nao ferramenta assistencial real.
- O foco inicial e hepatologia.
- Nao expandir para outras especialidades ainda.
- O AB4 deve ser central em primeiras consultas.
- Em acompanhamentos, AB4 so deve ser aplicado quando houver diagnostico,
  etiologia ou hipotese ainda em aberto.
- Acompanhamentos com diagnostico fechado devem priorizar evolucao, adesao,
  tecnica, comunicacao e gestao, nao anamnese classica completa.
- O aluno deve ter espaco para escrever:
  - impressao diagnostica / pensamento clinico;
  - conduta.
- Esses campos devem alimentar a avaliacao AB4.
- A interface deve ser muito limpa, com pouca poluicao visual.
- O catalogo de exames deve aceitar busca e tambem exames livres.
- Prescricao deve permitir busca de medicamento e ajuste manual de posologia.
- Guidelines tecnicas futuras devem se basear nas principais sociedades:
  SBH, AASLD, EASL e outras quando necessario.

## Metodo AB4

Documento-base interno:

```text
docs/ab4-method-operationalization.md
```

Artigo original do usuario, usado como base conceitual:

```text
C:\Users\ander\Downloads\AB4_Philosophy_of_Medicine_Draft_Revised_clean (2).docx
```

Os quatro movimentos:

1. A1 - Imaginacao poetica: ver o caso antes de nomear a doenca.
2. A2 - Plausibilidade retorica: organizar hipoteses plausiveis.
3. A3 - Confrontacao dialetica: testar a hipotese contra alternativas.
4. A4 - Demonstracao analitica: justificar conclusao, mecanismo e plano.

Arquivos principais do AB4:

```text
src/assessment/ab4Evaluator.mjs
tests/ab4Evaluator.test.mjs
```

Estado atual:

- O avaliador AB4 e heuristico, local e testavel.
- Retorna score total, subescores A1-A4, evidencias, falhas e `axisFeedback`.
- A UI mostra um bloco proprio chamado "Leitura AB4".
- O AB4 usa conversa + impressao diagnostica + conduta quando disponiveis.
- O AB4 nao deve ficar escondido dentro de "melhorias" genericas.

## Estado Atual Da Implementacao

Stack:

- Node.js nativo.
- Sem dependencias externas obrigatorias.
- Testes com `node:test`.
- Frontend prototipado em HTML/CSS/JS puro.
- OpenAI API integrada por servidor local simples.

Entradas web:

```text
public/standalone.html
public/index.html
public/styles.css
public/app.mjs
```

Na pratica, o usuario tem testado principalmente:

```text
public/standalone.html
```

Servidor local:

```text
src/server.mjs
```

IA:

```text
src/ai/consultationAi.mjs
src/config/env.mjs
```

Dominio:

```text
src/domain/clinicService.mjs
src/domain/responseEvaluator.mjs
src/domain/examCatalog.mjs
src/domain/medicationCatalog.mjs
src/domain/medicationEffects.mjs
src/domain/returnPlans.mjs
src/domain/seeds.mjs
src/domain/store.mjs
src/domain/validators.mjs
```

Testes:

```text
tests/*.test.mjs
```

## Como Rodar

O projeto exige Node >= 22.

Se `node` estiver no PATH:

```powershell
npm test
node src/server.mjs
```

No ambiente Codex atual, o Node empacotado fica aqui:

```powershell
& 'C:\Users\ander\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/*.test.mjs
```

Para iniciar o servidor local em segundo plano:

```powershell
Start-Process -FilePath 'C:\Users\ander\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' -ArgumentList 'src/server.mjs' -WorkingDirectory 'C:\Users\ander\OneDrive\Documentos\Consultóio Vivo' -WindowStyle Hidden
```

Abrir:

```text
http://127.0.0.1:4173/public/standalone.html#pacientes
```

Se houver cache do navegador, adicionar query string:

```text
http://127.0.0.1:4173/public/standalone.html?v=dev#pacientes
```

Status da OpenAI:

```text
http://127.0.0.1:4173/api/openai/status
```

## OpenAI API

Existe arquivo `.env` local com chave do usuario. Nao exibir a chave em logs,
documentos ou respostas.

O status deve retornar apenas:

```json
{"configured":true,"model":"..."}
```

O modelo estava configurado como `gpt-5.4-mini` no ultimo teste local. Verificar
`src/config/env.mjs` para comportamento atual.

## Fluxo Atual Na UI

1. Abrir pagina em `standalone.html`.
2. Clicar em `Adicionar caso` ou `Novo caso hepato`.
3. Selecionar paciente na carteira.
4. Iniciar consulta.
5. Conversar com o paciente simulado.
6. A conversa alimenta anamnese ou evolucao.
7. O exame fisico e gerado pelo sistema.
8. O aluno preenche:
   - impressao diagnostica / pensamento clinico;
   - conduta.
9. O aluno pode solicitar exames.
10. O aluno pode prescrever medicamentos com posologia manual.
11. Encerrar consulta.
12. Ver feedback do preceptor e leitura AB4.
13. Gerar retorno, quando fizer sentido.

## Banco Atual De Casos Hepatologicos

Em `public/standalone.html`, procurar:

```text
hepatologyCaseTemplates
```

Casos atuais:

- Carlos M.: alteracao hepatocelular metabolica, MASLD vs outras causas.
- Mariana R.: prurido + colestase, PBC/obstrucao/medicamentosa.
- Roberto A.: ascite/edema, suspeita de cirrose/hipertensao portal.
- Ana P.: ictericia e hepatite aguda, viral vs autoimune vs medicamentosa.
- Joao H.: anti-HCV positivo incidental, exposicao previa vs infeccao ativa.

Objetivo desses casos: aumentar diversidade cognitiva para testar AB4.

Cada caso tem:

- identificacao;
- queixa principal;
- foco de aprendizado;
- prompt inicial;
- labs basais;
- exame fisico basal;
- estado comportamental;
- relacao medico-paciente inicial.

## Exames

Arquivo principal:

```text
src/domain/examCatalog.mjs
```

No standalone ha um catalogo duplicado embutido. Isso e aceitavel no prototipo,
mas deve ser refatorado no futuro.

Estado atual:

- Busca por exame.
- Catalogo inclui exames laboratoriais, imagem, endoscopia e biópsia hepatica.
- Autoanticorpos adicionados: FAN/ANA, ASMA, AMA, anti-LKM1, anti-SLA/LP,
  p-ANCA.
- Se o exame nao existir, o medico pode digitar livremente e adicionar como
  exame personalizado.
- Retorno gera resultado apenas para exames solicitados.
- Resultados numericos devem vir com valor e referencia quando aplicavel.
- Exames de imagem/histopatologia retornam laudo descritivo.

Ponto futuro importante:

- IA deve gerar resultados/laudos contextuais para exames livres, com data de
  realizacao, coerencia clinica e variabilidade de cenarios.

## Prescricoes

Arquivos:

```text
src/domain/medicationCatalog.mjs
src/domain/medicationEffects.mjs
```

Estado atual:

- Busca por medicamento.
- Sem lista grande pre-aberta.
- O medico ajusta posologia manualmente.
- Botao para repetir prescricao anterior.
- Medicacoes prescritas em uma consulta entram como medicacoes em uso apos
  encerrar a consulta.
- Há logica inicial para efeitos de semaglutida em peso, IMC, cintura e exames.

Ponto futuro:

- Usar base/bulario confiavel e indexavel.
- Nao automatizar posologia como se fosse recomendacao assistencial final.
- Manter carater educacional/simulado.

## Anamnese, Evolucao E Exame Fisico

Primeira consulta:

- Deve usar anamnese estruturada por topicos.
- A IA deve organizar informacoes em:
  - QP;
  - HDA;
  - HPP;
  - Medicacoes;
  - Alergias;
  - HF;
  - HS/Habitos;
  - Revisao dirigida.

Acompanhamento:

- Nao deve usar anamnese classica.
- Deve usar evolucao resumida da conversa.

Exame fisico:

- Gerado pelo sistema.
- Deve ser completo o suficiente para consulta hepatologica:
  - sinais vitais;
  - peso;
  - IMC;
  - cintura quando relevante;
  - geral;
  - cardiovascular;
  - respiratorio;
  - abdome;
  - sinais hepaticos/pele.
- Nao incluir exame neurologico ou osteoarticular salvo queixa correspondente.

Campos finais obrigatorios:

- Impressao diagnostica / pensamento clinico.
- Conduta.

Esses dois campos sao essenciais para avaliacao AB4.

## Feedback E Avaliacao

Arquivo generico:

```text
src/domain/responseEvaluator.mjs
```

O feedback atual tem:

- score geral do preceptor;
- pontos fortes;
- melhorias;
- Leitura AB4 quando aplicavel.

AB4 deve:

- ser especifico;
- indicar subescores A1-A4;
- mostrar eixos parcialmente presentes;
- nao soar generico;
- usar evidencias da consulta e dos campos de raciocinio.

Problema ja identificado e parcialmente corrigido:

- Antes, uma consulta ruim gerava tudo em melhorias e escondia movimentos AB4
  parciais. Agora existe bloco `Leitura AB4`.

## UX E Design

Direcao preferida pelo usuario:

- Muito clean.
- Poucas cores simultaneas.
- Sem cards em excesso.
- Evitar listas grandes abertas.
- Exames e prescricoes devem ser por busca.
- Fluxo sequencial intuitivo:
  - consulta;
  - ficha/evolucao;
  - impressao/conduta;
  - exames;
  - prescricoes;
  - encerrar consulta.

Evitar:

- feedback aparecendo antes do fim;
- botoes verdes concorrendo com acao principal;
- historico de consultas visualmente poluido;
- campos muito pequenos para anamnese/evolucao/exame fisico;
- controles editaveis para indicadores que deveriam ser consequencia de
  performance.

## Documentos Importantes

Ler nesta ordem:

1. `README.md`
2. `docs/product-strategy.md`
3. `docs/ab4-method-operationalization.md`
4. `docs/clinical-knowledge-strategy.md`
5. `docs/roadmap.md`
6. `docs/architecture.md`
7. `docs/integration-contract.md`
8. `docs/tooling-and-limitations.md`

## Testes

Rodar sempre apos alteracoes:

```powershell
& 'C:\Users\ander\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/*.test.mjs
```

Ultimo estado conhecido antes deste handoff:

```text
44 testes passando
```

Areas cobertas:

- importacao e carteira de paciente;
- retornos;
- exames;
- efeitos de medicacao;
- resposta do aluno;
- sessao de consulta;
- penalidade por linguagem ofensiva;
- AB4;
- IA/fallback;
- env/OpenAI;
- assets web/standalone.

## Cuidados Ao Editar

- Nao expor `.env` ou chave OpenAI.
- Nao reverter mudancas existentes sem entender o historico.
- Evitar renomeacoes amplas enquanto o projeto ainda esta em prototipo.
- Manter `standalone.html` funcionando, pois e a tela mais usada pelo usuario.
- Se mexer em logica compartilhada, atualizar tambem os testes.
- Ao alterar UX, verificar visualmente no navegador.
- Ao alterar AB4, adicionar teste especifico em `tests/ab4Evaluator.test.mjs`.
- Ao alterar UI standalone, adicionar/ajustar teste em `tests/webAssets.test.mjs`.

## Proximos Passos Recomendados

### 1. Gerador De Casos Por Arquetipo

Transformar `hepatologyCaseTemplates` em gerador:

- MASLD/metabolico;
- colestase/PBC;
- cirrose/ascite;
- hepatite aguda;
- HCV incidental;
- DILI;
- hemocromatose;
- Wilson em paciente jovem;
- hepatite autoimune.

Cada caso deve variar:

- gravidade;
- temperamento;
- autoeficacia;
- adesao;
- achados fisicos;
- labs;
- armadilhas cognitivas;
- informacoes reveladas apenas se o aluno perguntar.

### 2. IA Como Paciente Mais Consistente

A IA deve:

- responder em primeira pessoa;
- manter dados do caso;
- nao entregar diagnostico de bandeja;
- revelar dados por perguntas adequadas;
- atualizar anamnese/evolucao de forma organizada;
- respeitar temperamento e autoeficacia;
- nao inventar fatos fora do caso sem necessidade.

### 3. IA Para Resultados De Exames

Gerar resultados coerentes com:

- exames solicitados;
- diagnostico verdadeiro do caso;
- tempo desde a consulta;
- medicações;
- adesao;
- efeitos adversos;
- variabilidade realista.

### 4. AB4 Mais Robusto

Migrar de heuristica simples para avaliacao hibrida:

- rubrica local estruturada;
- IA extraindo evidencias por eixo;
- score e justificativa auditaveis;
- comparacao com impressao diagnostica e conduta;
- feedback especifico, nao generico.

### 5. Guidelines Tecnicas

Criar camada de conhecimento para hepatologia:

- SBH;
- AASLD;
- EASL;
- OMS quando aplicavel.

Separar claramente:

- AB4 = como pensou;
- tecnica/guideline = se a conduta esta alinhada.

### 6. Progressao E Ranking

Depois que a avaliacao estiver confiavel:

- faixas de performance;
- liberacao de novos pacientes de primeira vez;
- impacto de performance no crescimento da clinica;
- ranking opcional com opt-in.

## Papéis De Subagentes Sugeridos

Quando disponivel em outra IA/agente, usar sob demanda:

1. Guardiao AB4:
   - verifica se a avaliacao respeita o metodo.
2. Revisor UX clean:
   - identifica poluicao visual, hierarquia ruim e fluxo confuso.
3. Revisor hepatologia/guidelines:
   - confere aderencia tecnica e lacunas clinicas.
4. Auditor de assimilacao da IA:
   - verifica se conversa vira anamnese/evolucao sem bagunca.

Importante: manter um agente principal integrador. Subagentes devem revisar ou
implementar fatias pequenas, nao redesenhar tudo em paralelo.

## Estado Mental Do Produto

Este projeto nao e apenas um chatbot medico. Ele deve ser uma simulacao
longitudinal de consultorio que conecta:

- competencia clinica;
- comunicacao;
- pensamento AB4;
- decisao tecnica;
- adesao do paciente;
- evolucao clinica;
- sucesso ficticio da clinica.

O objetivo e treinar o aluno a pensar, conversar, decidir e acompanhar.

