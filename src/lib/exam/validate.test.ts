import { describe, it, expect } from 'vitest'
import { passesSpec, type ExamQuestion } from './validate'

const opts = (texts: string[]): ExamQuestion['options'] => texts.map((t, i) => ({ key: 'ABCDE'[i], text: t }))

// Enunciado real-like: vinheta com idade + vitais/labs numéricos, ~60+ palavras.
const goodStem =
  'Mulher de 58 anos com hipertensão arterial sistêmica em tratamento irregular é encaminhada ao ambulatório com fadiga e dispneia aos esforços, com piora progressiva nas últimas semanas. Ao exame físico, ritmo cardíaco regular, crépitos em bases pulmonares e pressão arterial de 148 x 90 mmHg, frequência cardíaca de 92 bpm. Ecocardiograma evidencia hipertrofia ventricular esquerda com fração de ejeção de 38%. Qual o fármaco com maior impacto na sobrevida a ser associado?'
const fourGood = opts([
  'espironolactona, por bloqueio da aldosterona e benefício de mortalidade na IC',
  'clortalidona, por controle volêmico e redução da pós-carga no quadro',
  'hidralazina isolada, por vasodilatação arterial direta e alívio sintomático',
  'clonidina, por ação simpatolítica central e controle pressórico sustentado',
])

describe('passesSpec', () => {
  it('aprova questão com vinheta, extensão e dados numéricos', () => {
    expect(passesSpec({ prompt: goodStem, options: fourGood, correct_key: 'A', explanation: 'x', topic: 't' }, 'enamed', false)).toBe(true)
  })
  it('reprova enunciado curto', () => {
    expect(passesSpec({ prompt: 'Qual o tratamento da hipertensão? Escolha a melhor opção abaixo entre os fármacos.', options: fourGood, correct_key: 'A', explanation: 'x', topic: 't' }, 'enamed', false)).toBe(false)
  })
  it('reprova ausência de vinheta/dados numéricos (área clínica)', () => {
    const noVig = 'O mecanismo de ação dos betabloqueadores envolve o antagonismo competitivo e reversível dos receptores adrenérgicos, reduzindo a resposta cronotrópica e inotrópica mediada pelo sistema nervoso simpático em diversos tecidos do organismo humano saudável.'
    expect(passesSpec({ prompt: noVig, options: fourGood, correct_key: 'A', explanation: 'x', topic: 't' }, 'enamed', false)).toBe(false)
  })
  it('reprova alternativa monossilábica', () => {
    expect(passesSpec({ prompt: goodStem, options: opts(['sim', 'não', 'talvez', 'nunca']), correct_key: 'A', explanation: 'x', topic: 't' }, 'enamed', false)).toBe(false)
  })
})
