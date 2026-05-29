# Escopo Do MVP

## Hipotese Central

O aluno retornara ao produto se sentir que possui uma carteira viva de pacientes
simulados, com evolucao, vinculo e consequencias clinicas/operacionais.

## Entra No MVP

- Projeto separado como modulo da Med Mind.
- Carteira de pacientes.
- Importacao simulada de paciente vindo do HepatoMind.
- Pacientes longitudinalizaveis.
- Retornos periodicos semi-estruturados.
- Conversa em primeira pessoa.
- Avaliacao tecnica.
- Avaliacao simples de comunicacao-vinculo.
- Escala de vinculo simples.
- MedCoin fixo.
- Conta virtual simples.
- Aluguel de sala basico.
- Secretaria com poucos perfis.
- Faturamento simulado.
- No-show basico.
- Grafico de performance em teia.
- Dashboard do consultorio.

## Fica Fora Do MVP

- Dinheiro real convertido em MedCoin.
- Cotacao dinamica com dolar ou IPCA.
- Compra de sala.
- Financiamento.
- Trafego pago avancado.
- Comunidade aberta.
- Ranking publico.
- Diretorio para pacientes reais.
- Marketplace medico.

## Primeiro Incremento Codavel

Criar um modulo funcional com:

- modelos principais;
- seeds de exemplo;
- rotas/funcoes para adicionar paciente;
- listagem de pacientes ativos;
- detalhe do paciente;
- atualizacao de vinculo;
- registro de receita/custo em MedCoin;
- resumo financeiro;
- dados mockados para grafico de performance;
- camada de contrato preparada para integracao futura.

## Criterios De Aceite

- Um aluno consegue adicionar um paciente simulado a carteira.
- O paciente aparece na lista de ativos.
- O aluno consegue abrir o detalhe do paciente.
- O detalhe mostra estado clinico, vinculo, proxima consulta e historico.
- O aluno consegue gerar pelo menos um retorno semi-estruturado.
- O retorno mostra apenas resultados de exames previamente solicitados.
- O resultado do exame mostra data de realizacao.
- O aluno consegue ver uma planilha evolutiva de resultados.
- O aluno consegue responder uma pergunta do paciente em primeira pessoa.
- O sistema entrega feedback simples de preceptor simulado.
- O aluno consegue iniciar uma consulta com cronometro progressivo.
- O aluno consegue conduzir uma conversa em multiplas mensagens.
- O feedback de competencia aparece ao final da consulta.
- Uma receita ou custo em MedCoin altera o saldo.
- O dashboard mostra pacientes ativos, saldo, receita, custo e risco de abandono.
- O grafico de performance recebe dados estruturados.
- O codigo nao depende diretamente do HepatoMind.
