import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// MicButton stub: injeta um transcript ao clicar.
vi.mock('./MicButton', () => ({
  MicButton: ({ onTranscript }: { onTranscript: (t: string) => void }) => (
    <button onClick={() => onTranscript('falei isso')}>mic-stub</button>
  ),
}))

// useSpeech stub: expõe play para asserção.
const { mockPlay, mockStop } = vi.hoisted(() => ({ mockPlay: vi.fn(), mockStop: vi.fn() }))
vi.mock('@/lib/audio/useSpeech', () => ({
  useSpeech: () => ({ state: 'idle', error: null, play: mockPlay, stop: mockStop }),
}))

import { ConsultationChat } from './ConsultationChat'

beforeEach(() => vi.clearAllMocks())

describe('ConsultationChat — voz', () => {
  it('MicButton anexa o transcript ao input', () => {
    render(<ConsultationChat consultationId="c-1" initialMessages={[]} onMessagesUpdate={() => {}} patientGender="F" />)
    fireEvent.click(screen.getByText('mic-stub'))
    expect((screen.getByPlaceholderText(/mensagem/i) as HTMLInputElement).value).toContain('falei isso')
  })

  it('botão 🔊 numa bolha do paciente toca com a voz do gênero', () => {
    const msgs = [{ role: 'patient' as const, content: 'estou com dor', timestamp: 't' }]
    render(<ConsultationChat consultationId="c-1" initialMessages={msgs} onMessagesUpdate={() => {}} patientGender="M" />)
    fireEvent.click(screen.getByLabelText(/ouvir resposta/i))
    expect(mockPlay).toHaveBeenCalledWith('estou com dor', 'onyx')
  })

  it('auto-play desligado por padrão: não toca sozinho ao renderizar respostas', () => {
    const msgs = [{ role: 'patient' as const, content: 'oi', timestamp: 't' }]
    render(<ConsultationChat consultationId="c-1" initialMessages={msgs} onMessagesUpdate={() => {}} patientGender="F" />)
    expect(mockPlay).not.toHaveBeenCalled()
  })

  it('o toggle de auto-play existe e começa desligado', () => {
    render(<ConsultationChat consultationId="c-1" initialMessages={[]} onMessagesUpdate={() => {}} patientGender="F" />)
    const toggle = screen.getByLabelText(/ouvir o paciente/i) as HTMLInputElement
    expect(toggle.checked).toBe(false)
  })
})
