# Memoria Estrategica Do Produto

Atualizado em: 2026-05-18

Copiado para Google Drive em 2026-05-18:
https://docs.google.com/document/d/1AD9JpgJV1aEMhaHO6zXcLBypg5439JoxV1vK7unX4Jk

## Nome De Trabalho

O nome "Consultorio Vivo" foi util para a fase de descoberta, mas o produto deve
ser tratado como:

```text
Med Mind - Modulo Consultorio
```

O nome final ainda esta em aberto.

## Tese Atual

O Med Mind - Modulo Consultorio e um ambiente de simulacao de consultorio medico
para:

- alunos de medicina;
- medicos recem-formados;
- medicos que ainda nao possuem consultorio;
- medicos que desejam aperfeicoar consulta, raciocinio, tecnica, comunicacao e
  gestao.

O produto pode operar como B2C, vendido diretamente a usuarios, e como B2B para
faculdades de medicina, ligas academicas, pos-graduacoes, residencias e escolas
medicas.

## Diferencial Proprietario

O produto nao deve ser apenas "mais um simulador de paciente". O diferencial e
incorporar o metodo AB4 de pensamento clinico nas primeiras consultas.

Documento operacional:

```text
docs/ab4-method-operationalization.md
```

Nas consultas de primeira vez, o aluno deve ser avaliado pela capacidade de:

- colher dados relevantes;
- organizar anamnese;
- construir hipoteses;
- raciocinar por probabilidade e gravidade;
- justificar conduta;
- comunicar o plano de forma compreensivel;
- conduzir a relacao medico-paciente.

O metodo AB4 deve se tornar uma competencia mensuravel dentro da performance.
Isso fortalece propriedade intelectual, diferencia o produto e cria uma camada
pedagogica menos imitavel.

## Competencias Avaliadas

O eixo de performance deve evoluir para quatro dimensoes:

- comunicacao;
- pensamento clinico, com metodo AB4;
- tecnica;
- gestao.

Essas competencias devem impactar a simulacao de consultorio. O aluno que melhora
performance ganha mais capacidade de abrir pacientes novos, reter pacientes,
melhorar adesao e aumentar faturamento ficticio.

## Progressao E Acesso A Pacientes

O aluno nao deve poder abrir pacientes de primeira vez ilimitadamente desde o
inicio. Novos pacientes devem ser liberados por faixas de performance.

Regra conceitual:

- performance baixa: foco em acompanhar pacientes ja existentes e corrigir
  lacunas;
- performance intermediaria: direito limitado a novos pacientes de primeira vez;
- performance alta: maior fluxo de pacientes novos e mais complexidade;
- performance excelente: acesso a desafios especiais, casos raros ou ranking.

Isso conecta aprendizado, competencia e sucesso da clinica simulada.

## Primeira Consulta Versus Acompanhamento

Primeira consulta:

- deve ter layout proprio;
- deve priorizar coleta de dados, pensamento clinico e metodo AB4;
- deve usar anamnese estruturada por topicos;
- nao deve revelar comorbidades antes de serem colhidas pelo aluno;
- deve permitir que o exame fisico seja gerado pelo sistema.

Acompanhamento:

- nao deve repetir anamnese classica;
- deve usar um sumario de evolucao da conversa;
- deve enfatizar adesao, sintomas, exames, medicamentos, efeitos adversos e
  conduta discutida.

## Rede, Ranking E Opt-In

No futuro, o produto pode se tornar uma rede de desenvolvimento profissional,
com ranking e reputacao educacional. O ranking deve ser opcional.

Diretriz:

- o medico/aluno escolhe se quer participar;
- ranking publico fica fora do MVP;
- ranking interno ou privado pode ser testado antes;
- evitar qualquer promessa de qualidade assistencial real.

## Relacao Com HepatoMind E HepatoKnowledge

HepatoMind segue como vertical clinica importante e fonte natural de pacientes
para o modulo consultorio. O contrato deve continuar por dados, sem dependencia
direta do codigo interno.

HepatoKnowledge foi citado como referencia de norte, mas ainda nao ha arquivo
local com esse nome neste projeto. Para reduzir perda de contexto, ele deve ser
adicionado a uma pasta de referencias, preferencialmente:

```text
docs/references/
```

ou armazenado no Google Drive e linkado aqui.

Enquanto isso nao acontecer, o projeto conhece apenas as premissas de
HepatoMind/HepatoKnowledge registradas nesta documentacao e na conversa.

## Organizacao Recomendada

Codigo:

- Git/GitHub como fonte principal;
- commits pequenos;
- testes antes de grandes mudancas.

Documentacao e referencias:

- Google Drive para documentos de produto, PDFs, brainstorms, estrategia e
  materiais de referencia;
- `docs/` no repositorio para memoria operacional minima;
- README apontando para documentos centrais.

Nao recomendado:

- usar Google Drive como repositorio principal de codigo;
- depender apenas da conversa para decisoes estrategicas;
- manter referencias essenciais fora do repo/Drive sem links.
