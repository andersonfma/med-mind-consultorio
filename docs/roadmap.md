# Roadmap Por Fases

## Fase 0 - Fundacao Arquitetural

Objetivo: preparar o projeto como produto independente da Med Mind, integravel
ao HepatoMind e a futuras verticais, mas com identidade propria.

Entregas:

- documentacao-base do projeto;
- decisoes arquiteturais iniciais;
- contrato de integracao com HepatoMind;
- modelos de dados conceituais;
- escopo do MVP;
- limites explicitos do que fica fora.
- memoria estrategica do produto e metodo AB4 como diferencial.

Status: em andamento.

## Fase 1 - Consultorio Essencial

Objetivo: criar a carteira longitudinal do aluno.

Features:

- adicionar paciente ao Consultorio Vivo;
- listar pacientes ativos;
- visualizar detalhe do paciente;
- exibir status clinico;
- exibir status de vinculo;
- exibir proxima consulta;
- exibir historico resumido;
- arquivar paciente;
- remover paciente da carteira.

## Fase 2 - Longitudinalidade Clinica

Objetivo: permitir que pacientes retornem ao longo do tempo.

Regra inicial:

- `1 semana real ~= 1 mes ficticio`.

Features:

- agendamento de proxima consulta;
- avanco de tempo ficticio;
- geracao de retorno clinico;
- novos exames;
- novas queixas;
- adesao ou nao adesao;
- intercorrencias;
- resumo da consulta;
- atualizacao do estado clinico.

Diretriz: comecar com roteiros semi-estruturados, evitando trajetorias livres
demais no primeiro ciclo.

Status: iniciada no prototipo. Ja existe geracao de retorno semi-estruturado
para hepatologia, com avanco de mes ficticio, atualizacao clinica, pergunta do
paciente, impacto no vinculo/adesao e receita de retorno em MedCoin. Tambem ha
caminho de no-show no dominio. Resultados de exames so aparecem quando foram
previamente solicitados pelo medico/aluno. O prototipo ja inclui busca em
catalogo inicial, exames de imagem, data de realizacao e planilha evolutiva.

Nota de catalogo: para uma versao completa no Brasil, usar a Tabela de
Procedimentos, Medicamentos e OPM do SUS (SIGTAP/DataSUS) como fonte-base de
procedimentos diagnosticos, com curadoria pedagogica por especialidade.

Regra de disponibilidade: no prototipo, exames solicitados recebem resultado no
retorno usando valor especifico do roteiro ou fallback simulado por categoria.
Exames pendentes devem ser excecao futura, controlada por regras como prazo de
processamento, exame externo, autorizacao, no-show ou laudo ainda nao liberado.
O sistema nao deve exibir "indisponivel" como resultado clinico.

## Prescricoes E Bulario

Status: iniciada no prototipo. A consulta mostra medicacoes em uso e permite
buscar/adicionar prescricoes a partir de um catalogo local pequeno. O medico
pode ajustar posologia antes de adicionar. Ao encerrar a consulta, prescricoes
ativas passam a compor as medicacoes em uso no acompanhamento seguinte.

Diretriz futura: a base indexada deve usar fonte oficial sempre que possivel. No
Brasil, a referencia principal e o Bulario Eletronico da Anvisa, que permite
consulta gratuita a bulas por profissionais e pela populacao. Tambem considerar
a Consulta a Registro de Medicamentos da Anvisa para verificar medicamentos
regularizados.

## Anamnese, Exame Fisico E Entrada Direta

Status: iniciada no prototipo. A consulta possui campos para anamnese e exame
fisico, registrados junto da consulta encerrada.

Decisao futura: o Consultorio Vivo deve permitir dois caminhos de entrada:

- paciente importado de uma vertical da Med Mind, como HepatoMind, ja com resumo
  clinico estruturado;
- paciente novo criado diretamente no Consultorio Vivo, com primeira consulta,
  anamnese completa, exame fisico, problemas ativos, medicacoes em uso e plano.

Esse cadastro direto deve ser tratado como submodulo proprio, para nao poluir o
fluxo de acompanhamento longitudinal.

## Fase 3 - Paciente Em Primeira Pessoa

Objetivo: transformar o paciente em personagem conversacional.

Features:

- paciente fala em primeira pessoa;
- aluno responde como medico;
- paciente reage conforme conteudo, clareza e empatia;
- sistema atualiza vinculo;
- preceptor entrega feedback apos a interacao.

Status: iniciada no prototipo. Retornos estruturados agora incluem pergunta do
paciente em primeira pessoa. O aluno pode escrever resposta e receber feedback
heuristico inicial de preceptor simulado. A interface agora suporta sessao de
consulta com cronometro progressivo, chat medico-paciente e feedback consolidado
ao encerrar.

Nota: as respostas do paciente ainda seguem roteiro heuristico local. A geracao
por IA em tempo real deve entrar quando houver backend, controle de custo,
persistencia e trilhos clinicos robustos.

## Fase 4 - Escala De Vinculo

Objetivo: medir a relacao medico-paciente simulada.

Variaveis iniciais do MVP:

- empatia;
- clareza;
- confianca;
- risco de abandono.

Diretriz: usar score numerico interno e linguagem qualitativa para o usuario.

Status: iniciada no prototipo. A resposta do aluno atualiza empatia, clareza,
confianca, adesao provavel e risco de abandono. A avaliacao ainda e heuristica,
sem IA externa.

## Fase 5 - Gestao Basica Do Consultorio

Objetivo: simular operacao simples do consultorio.

Features:

- conta virtual em MedCoin;
- receita por consulta;
- custo de aluguel;
- custo de secretaria;
- custo operacional basico;
- no-show;
- ticket medio;
- faturamento mensal;
- lucro simulado;
- pacientes ativos;
- pacientes em risco de abandono.

## Fase 6 - MedCoin Inicial

Objetivo: criar moeda ficticia didatica.

Regra do MVP:

- `1 MedCoin = R$ 1 ficticio`.

Fora do escopo:

- dinheiro real;
- saque;
- compra de moeda;
- cotacao dinamica;
- promessa de retorno.

## Fase 7 - Secretaria E Equipe

Objetivo: simular escolhas operacionais simples.

Perfis iniciais:

- sem secretaria;
- secretaria junior;
- secretaria experiente;
- secretaria premium/remota.

## Fase 8 - Performance Em Teia

Objetivo: representar evolucao do aluno.

Dimensoes:

- tecnica;
- comunicacao;
- pensamento clinico, com metodo AB4;
- gestao.

Tecnica deve preservar o metodo proprietario:

- narrativa clinica;
- ponderacao probabilistica/Bayes qualitativo;
- confronto entre hipoteses;
- demonstracao fisiopatologica/analitica.

## Fase 9 - Progressao Por Competencia

Objetivo: conectar performance educacional ao crescimento da clinica simulada.

Regras conceituais:

- novos pacientes de primeira vez nao sao ilimitados;
- abertura de novos pacientes depende de escore minimo;
- faixas de performance definem quantidade e complexidade de primeiras vezes;
- melhor competencia aumenta acesso a pacientes, retencao e faturamento
  ficticio;
- acompanhar pacientes existentes continua possivel mesmo quando a performance
  ainda nao libera novos pacientes.

Competencias de referencia:

- comunicacao;
- pensamento clinico/AB4;
- tecnica;
- gestao.

## Fase 10 - Conhecimento Clinico E Guidelines

Objetivo: criar feedback tecnico auditavel, baseado em sociedades nacionais e
internacionais por especialidade.

Diretrizes:

- a IA nao deve ser fonte primaria da verdade clinica;
- guidelines devem ser registrados com fonte, ano, URL, sociedade e status;
- recomendações devem virar regras pedagogicas testaveis;
- feedback tecnico deve citar a base usada de forma educacional;
- comecar por uma condicao piloto antes de expandir para varias
  especialidades.

Especialidades alvo:

- clinica medica;
- hepatologia;
- endocrinologia;
- gastroenterologia;
- cardiologia;
- pneumologia;
- neurologia;
- demais especialidades clinicas.

## Fases Pos-MVP

Itens para depois da validacao de retencao:

- trafego pago ficticio avancado;
- compra de sala;
- financiamento;
- ranking privado;
- comunidade fechada;
- desafios semanais;
- perfil educacional publico com cautela juridica.

Nao implementar agora:

- diretorio para pacientes reais;
- marketplace medico;
- ranking publico de melhores medicos.
