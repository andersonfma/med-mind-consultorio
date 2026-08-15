// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerformanceRadar } from './PerformanceRadar'

describe('PerformanceRadar', () => {
  it('estado vazio: sem dados/n 0 mostra CTA', () => {
    render(<PerformanceRadar result={{ pensamentoClinico: null, comunicacao: null, tecnica: null, n: 0, reasoningCoverage: null }} />)
    expect(screen.getByText(/Faça consultas/i)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/patients/new')
  })

  it('estado parcial: eixo null aparece como "sem dados"', () => {
    render(<PerformanceRadar result={{ pensamentoClinico: 8, comunicacao: null, tecnica: 6, n: 3, reasoningCoverage: { reasoned: 3, expected: 3 } }} />)
    expect(screen.getByText(/sem dados/i)).toBeInTheDocument()
    expect(screen.getByText(/baseado em 3 consultas/i)).toBeInTheDocument()
  })

  it('estado cheio: mostra os três valores', () => {
    render(<PerformanceRadar result={{ pensamentoClinico: 8, comunicacao: 7, tecnica: 6, n: 5, reasoningCoverage: { reasoned: 5, expected: 5 } }} />)
    expect(screen.getByLabelText(/Radar de performance/i)).toBeInTheDocument()
    expect(screen.getByText(/baseado em 5 consultas/i)).toBeInTheDocument()
  })

  it('cobertura incompleta: nudge mostra X de N e incentiva preencher', () => {
    render(<PerformanceRadar result={{ pensamentoClinico: 8, comunicacao: 7, tecnica: 6, n: 4, reasoningCoverage: { reasoned: 1, expected: 3 } }} />)
    // mostra a razão preenchido/esperado
    expect(screen.getByText(/1 de 3/i)).toBeInTheDocument()
    // e um chamado para preencher o raciocínio
    expect(screen.getByText(/raciocínio/i)).toBeInTheDocument()
  })

  it('cobertura completa: reforço positivo, sem alarme', () => {
    render(<PerformanceRadar result={{ pensamentoClinico: 8, comunicacao: 7, tecnica: 6, n: 3, reasoningCoverage: { reasoned: 3, expected: 3 } }} />)
    expect(screen.getByText(/todas as 3 consultas/i)).toBeInTheDocument()
  })

  it('sem raciocínio esperado (só seguimentos): não mostra nudge de cobertura', () => {
    render(<PerformanceRadar result={{ pensamentoClinico: null, comunicacao: 7, tecnica: 6, n: 2, reasoningCoverage: null }} />)
    expect(screen.queryByText(/raciocínio clínico registrado/i)).not.toBeInTheDocument()
  })
})
