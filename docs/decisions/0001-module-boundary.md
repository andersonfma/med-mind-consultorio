# ADR 0001 - Fronteira Do Modulo Consultorio Vivo

Data: 2026-05-16

## Status

Aceita.

## Contexto

O Consultorio Vivo sera desenvolvido em paralelo ao HepatoMind, mas deve se
integrar a ele no futuro. O HepatoMind valida o motor clinico de hepatologia. O
Consultorio Vivo valida longitudinalidade, vinculo e gestao simulada.

## Decisao

Manter Consultorio Vivo como modulo/projeto separado, integravel por contrato de
dados.

O HepatoMind nao sera dependencia direta do Consultorio Vivo. Ele enviara um
objeto estruturado contendo o paciente, resumo clinico e metadados de origem.

## Consequencias

Beneficios:

- reduz acoplamento;
- facilita futuras especialidades;
- permite evoluir a simulacao longitudinal sem sobrecarregar HepatoMind;
- deixa contrato de integracao claro.

Custos:

- exige disciplina de versionamento de contrato;
- pode haver duplicacao inicial de tipos e seeds;
- autenticacao compartilhada precisara ser decidida depois.

