// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerformanceRadar } from './PerformanceRadar'

describe('PerformanceRadar', () => {
  it('estado vazio: sem dados/n 0 mostra CTA', () => {
    render(<PerformanceRadar result={{ pensamentoClinico: null, comunicacao: null, tecnica: null, n: 0 }} />)
    expect(screen.getByText(/Faça consultas/i)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/patients/new')
  })

  it('estado parcial: eixo null aparece como "sem dados"', () => {
    render(<PerformanceRadar result={{ pensamentoClinico: 8, comunicacao: null, tecnica: 6, n: 3 }} />)
    expect(screen.getByText(/sem dados/i)).toBeInTheDocument()
    expect(screen.getByText(/baseado em 3 consultas/i)).toBeInTheDocument()
  })

  it('estado cheio: mostra os três valores', () => {
    render(<PerformanceRadar result={{ pensamentoClinico: 8, comunicacao: 7, tecnica: 6, n: 5 }} />)
    expect(screen.getByLabelText(/Radar de performance/i)).toBeInTheDocument()
    expect(screen.getByText(/baseado em 5 consultas/i)).toBeInTheDocument()
  })
})
