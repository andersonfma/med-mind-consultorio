# Contrato De Integracao

Este documento define o contrato inicial para que HepatoMind ou futuras verticais
da Med Mind enviem pacientes ao Consultorio Vivo.

## Entrada: `CreateClinicPatientFromCase`

```json
{
  "sourceProduct": "HepatoMind",
  "sourceCaseId": "case_123",
  "specialty": "hepatology",
  "patientName": "Carlos M.",
  "patientAge": 48,
  "clinicalSummary": "Paciente com MASLD, obesidade, alteracao de ALT e resistencia a mudanca de estilo de vida.",
  "initialDiagnosisHypotheses": ["MASLD", "MASH", "alcohol-related liver disease"],
  "baselineLabs": {
    "ALT": "82",
    "AST": "54",
    "GGT": "110",
    "platelets": "220000"
  },
  "studentInitialPerformance": {
    "technicalReasoning": "adequate",
    "mainWeakness": "did not explore adherence barriers"
  },
  "longitudinalEligible": true
}
```

## Campos Obrigatorios

- `sourceProduct`
- `sourceCaseId`
- `specialty`
- `patientName`
- `patientAge`
- `clinicalSummary`
- `longitudinalEligible`

## Campos Recomendados

- `initialDiagnosisHypotheses`
- `baselineLabs`
- `studentInitialPerformance`
- `behavioralProfile`
- `riskFlags`
- `recommendedFollowUpWindow`

## Saida Esperada

Ao receber um paciente elegivel, o Consultorio Vivo deve criar:

- `SimulatedPatient`;
- `ClinicPatientState`;
- estado clinico inicial;
- estado relacional inicial;
- proxima consulta;
- historico longitudinal inicial;
- primeira transacao, se houver receita simulada.

Exemplo de resposta:

```json
{
  "clinicPatientStateId": "clinic_patient_state_001",
  "patientId": "patient_001",
  "status": "active",
  "nextVisitAt": "2026-05-23",
  "fictionalMonth": 0
}
```

## Validacoes

O Consultorio Vivo deve rejeitar ou marcar como nao importavel:

- paciente sem `sourceCaseId`;
- paciente sem resumo clinico;
- paciente com `longitudinalEligible: false`;
- especialidade desconhecida sem fallback;
- objeto sem idade ou identificacao minima.

## Versionamento

Adicionar `contractVersion` quando a integracao passar do mock para API real.

Sugestao:

```json
{
  "contractVersion": "2026-05-16.v1"
}
```

## Principio De Compatibilidade

Novos campos devem ser opcionais por padrao. Remover ou renomear campos exige
nova versao do contrato.

