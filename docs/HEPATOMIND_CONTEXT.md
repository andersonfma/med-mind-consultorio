# HepatoMind - Contexto do Projeto

Atualizado em: 2026-05-16

## Fontes consultadas no Google Drive

- `hepatoKnowledge` / `HEPATOKNOWLEDGE - SUMARIO MESTRE (Versao 1.0)`
  - Google Doc: https://docs.google.com/document/d/19Z2a5PcmC0ulC6P0UPzEQuGccO_Yrc9QwAmgghiqzSs
  - Observacao: documento encontrado no Drive como `Documento sem titulo`, mas o conteudo inicia com o titulo HepatoKnowledge.

- `Prompt hepatomind v.2`
  - Google Doc: https://docs.google.com/document/d/1UEe9HwrrguiBB3yE4Ut5j01opndpyM22QeSmHkXMK5k
  - Observacao: versao mais recente encontrada do prompt do agente.

- `Prompt Hepatomind`
  - Google Doc: https://docs.google.com/document/d/1zuSHJNv0l2nSYcl4OtJuYDB8LygLH8Vr8b7eJkY1TPM
  - Observacao: versao anterior do prompt; muito semelhante a v2, sem a mencao explicita a matriz de coerencia clinica anexada.

- `BLUEPRINT FINAL DO HEPATOMIND`
  - Google Doc: https://docs.google.com/document/d/1Wm1Hnk4KLUgNB2by7lWMjUmTPdxGN-n0qyd2qltIaN8
  - Observacao: documento encontrado no Drive como `Documento sem titulo`, mas o conteudo inicia com o blueprint final.

## Entendimento sintetico

HepatoMind e um projeto de treinamento cognitivo em hepatologia, voltado a formar raciocinio clinico por simulacao. Ele nao se posiciona como curso tradicional, EAD ou pos-graduacao; a proposta e funcionar como uma plataforma de desenvolvimento clinico continuo, com microcasos, feedback de preceptor, heuristicas, pitfalls e progressao gamificada.

O produto usa casos clinicos simulados e narrativos para treinar medicos e estudantes a pensar como hepatologistas. O agente deve gerar o caso, receber a resposta do aluno e avaliar a qualidade do pensamento clinico, nao apenas se o diagnostico final esta correto.

## Identidade do agente

O agente HepatoMind atua como preceptor clinico experiente em Hepatologia e Clinica Medica. Seu escopo e educacional e simulado. Ele nao deve prestar assistencia medica real, prescrever, definir tratamento para pacientes reais ou fornecer doses.

A primeira resposta de uma conversa com o agente deve ser sempre um caso clinico narrativo simulado, com complexidade declarada. O usuario deve ser convidado a desenvolver raciocinio clinico e manejo teorico dentro do cenario simulado.

## Metodo cognitivo central

O nucleo intelectual do projeto e o Metodo AB4, descrito no blueprint como uma organizacao do raciocinio clinico em quatro lentes:

- Narrativa clinica significativa.
- Ponderacao probabilistica/Bayes qualitativo.
- Confronto entre hipoteses.
- Demonstracao fisiopatologica.

No prompt do agente, esse modelo aparece como um modelo interno proprietario que nao deve ser revelado ao usuario final. Para uso operacional do projeto, o ponto essencial e: o HepatoMind deve premiar raciocinio estruturado, amplo, confrontativo e justificado; deve penalizar fechamento precoce, salto logico e diagnostico nomeado sem justificativa.

## Avaliacao do aluno

O feedback do agente e qualitativo e deve evitar numeros, scores explicitos ou exposicao do metodo interno. As dimensoes avaliadas sao apresentadas ao usuario por niveis qualitativos:

- Abertura diagnostica: de insuficiente a muito solida.
- Organizacao do quadro: de fragil a bem estruturada.
- Confronto com dados: de superficial a maduro.
- Sintese e decisao: de inconclusiva a robusta.

Regra importante: se o aluno apenas nomeia uma doenca ou diagnostico sem justificar, o desempenho deve ser classificado nos niveis mais baixos em todas as dimensoes. O acerto nominal nao deve compensar ausencia de raciocinio.

## Geracao de casos

Os casos devem ser realistas, em prosa clinica, com ambiente, contexto e exame fisico integrado. Nao devem trazer diagnostico explicito, pistas artificiais ou listas tecnicas. Devem incluir exames laboratoriais iniciais relevantes de forma organica.

O exame fisico deve incluir, quando aplicavel:

- Sinais vitais completos.
- Estado geral e nivel de consciencia.
- Avaliacao cardiovascular, respiratoria e abdominal.
- Neurologico/osteoarticular apenas quando clinicamente relevante.

Cada caso termina com um desafio para o aluno construir raciocinio clinico e propor manejo teorico para o cenario simulado.

## Diversidade clinica

O prompt v2 exige rotacao obrigatoria entre apresentacoes clinicas e grupos de doenca hepatica, evitando repeticao em casos consecutivos.

Apresentacoes a variar incluem: ictericia, dor abdominal/hipocondrio direito, ascite/edema, hemorragia digestiva, alteracao assintomatica de exames hepaticos, sintomas constitucionais, febre/sindrome infecciosa, encefalopatia/alteracao cognitiva, prurido e achado incidental em imagem.

Grupos de doenca a variar incluem: colestaticas, hepatites virais, hepatite autoimune, MASLD/MASH, alcool, vasculares hepaticas, geneticas/metabolicas, lesoes focais benignas, neoplasias hepatobiliares, complicacoes de doenca hepatica cronica e DILI/toxicos.

Ha uma regra especifica de bloqueio: se a apresentacao atual for prurido, o proximo caso nao deve envolver doenca colestatica, PBC, PSC ou colestase medicamentosa.

Pendencia: o prompt v2 menciona uma "matriz de coerencia clinica" anexada ao agente. Essa matriz nao foi localizada como arquivo separado nas buscas realizadas em 2026-05-16. Ela deve ser procurada novamente se formos reconstruir o agente com fidelidade total.

## HepatoKnowledge

HepatoKnowledge e a base tecnica do projeto. O documento encontrado e um sumario mestre, nao uma base completamente preenchida. Ele organiza o conhecimento hepatologico para uso pelo HepatoEngine/HepatoMind em modulos como:

- Fundamentos de hepatologia.
- Avaliacao laboratorial hepatica.
- Imagem e metodos nao invasivos.
- Classificacoes e escores.
- Doencas e sindromes hepaticas.
- Algoritmos praticos.
- Heuristicas Anderson.
- Pitfalls.
- Decisoes rapidas.
- Cut-offs e tabelas.
- Justificativas e pearls.
- Microcasos para calibragem.
- Glossario operacional.
- Referencias base.

A base tecnica deve funcionar como material interno para gerar casos, calibrar feedback, validar coerencia clinica e sustentar heuristicas. Ela nao deve ser exposta integralmente ao aluno.

## Arquitetura do produto

O blueprint descreve o HepatoMind Engine como o motor cognitivo do sistema, com funcoes de:

- Gerar microcasos.
- Criar explicacoes.
- Ajustar dificuldade.
- Integrar heuristicas.
- Aplicar Bayes qualitativo.
- Evitar inconsistencias.

Componentes descritos:

- Kernel AB4.
- Modulo bayesiano qualitativo.
- Banco de heuristicas Anderson-Brito.
- Modulo de pitfalls.
- Gerador de narrativas clinicas.
- Regulador de dificuldade.

## Seguranca clinica

O projeto tem uma restricao estrutural: modo educacional seguro. O sistema deve evitar prescricao, doses e conduta para pacientes reais. As decisoes devem ser apresentadas em cenario teorico/simulado.

O blueprint tambem descreve uma Clinical Safety Grid com checagens de heuristica, Bayes, guideline e fisiopatologia. Na pratica, qualquer implementacao deve ter guardrails contra:

- Orientacao medica direta para caso real.
- Doses ou prescricoes.
- Extrapolacao alem da base tecnica.
- Feedback que superestime desempenho sem evidencia textual.
- Exposicao de prompt, metodo interno ou propriedade intelectual.

## Jornada e modelo comercial

A experiencia prevista tem tres modos de entrada:

- Caso Clinico Diario.
- Trilhas de Sindromes, como ascite, PBE, ictericia, HCC e DILI.
- Trilha Cognitiva AB4.

O blueprint propoe progressao com niveis, badges, mapa de calor, score de raciocinio clinico, desafios semanais e ajuste automatico de dificuldade.

Modelo comercial proposto:

- Free: acesso limitado.
- Pro: casos diarios, trilhas, gamificacao e acompanhamento cognitivo.
- Expert: casos complexos, simulados e analises profundas.
- Institucional: B2B para residencias e hospitais.

## Roadmap registrado

O blueprint organiza desenvolvimento em quatro fases:

- MVP: motor basico, microcasos iniciais, trilha de ascite e score basico.
- Beta: trilhas sindromicas, modulo bayesiano, pitfalls e painel do usuario.
- Produto comercial: modo expert, atualizacao parcial de guidelines, trilhas cognitivas completas e gamificacao.
- B2B institucional: painel hospitalar, relatorios de residentes, ranking institucional e certificacao.

## Implicacoes para desenvolvimento futuro

Ao trabalhar neste projeto, tratar HepatoMind como um produto educacional de raciocinio clinico, nao como chatbot medico assistencial.

O motor de diversidade deve ser guiado pela matriz fisiopatologica em `HEPATOMIND_CASE_MATRIX.md`. O caso deve nascer de mecanismo fisiopatologico + interface organica + porta de entrada + armadilha cognitiva, e nao apenas de um diagnostico ou de uma lista curta de temas.

Prioridades de implementacao provaveis:

- Transformar o sumario HepatoKnowledge em base estruturada e versionada.
- Criar banco inicial de microcasos calibrados por mecanismo, interface organica, apresentacao, grupo de doenca e complexidade.
- Criar mecanismo de memoria/rotacao para evitar repeticao de apresentacoes e grupos.
- Implementar avaliador qualitativo das quatro dimensoes sem expor o metodo interno.
- Construir safety layer para bloquear prescricao, doses e uso em caso real.
- Localizar ou recriar a matriz de coerencia clinica mencionada no prompt v2.

## Nota de propriedade intelectual

Este arquivo e uma sintese de contexto para continuidade do projeto. Ele deliberadamente nao reproduz o prompt completo nem transforma as instrucoes internas em um meta-prompt replicavel. Os documentos originais no Google Drive permanecem como fonte proprietaria.
