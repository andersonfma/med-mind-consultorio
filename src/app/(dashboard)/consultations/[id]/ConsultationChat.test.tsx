import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// MicButton stub: injeta um transcript ao clicar.
vi.mock('./MicButton', () => ({
  MicButton: ({ onTranscript }: { onTranscript: (t: string) => void }) => (
    <button onClick={() => onTranscript('falei isso')}>mic-stub</button>
  ),
}))

// useSpeech stub: expõe play/stop para asserção. `state` fixo em 'playing' porque
// o componente decide ▶/■ combinando seu próprio playingIdx com `state !== 'idle'`;
// como playingIdx começa null, isso não afeta a renderização inicial (sempre 🔊),
// e permite exercitar a transição 🔊→■→stop após o clique que seta playingIdx.
const { mockPlay, mockStop } = vi.hoisted(() => ({ mockPlay: vi.fn(), mockStop: vi.fn() }))
vi.mock('@/lib/audio/useSpeech', () => ({
  useSpeech: () => ({ state: 'playing', error: null, play: mockPlay, stop: mockStop }),
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
    expect(mockPlay).toHaveBeenCalledWith('estou com dor', 'onyx', 1.25)
  })

  it('depois de tocar, a bolha vira ■ e clicar nela chama stop()', () => {
    const msgs = [{ role: 'patient' as const, content: 'estou com dor', timestamp: 't' }]
    render(<ConsultationChat consultationId="c-1" initialMessages={msgs} onMessagesUpdate={() => {}} patientGender="M" />)
    fireEvent.click(screen.getByLabelText(/ouvir resposta/i))
    const stopBtn = screen.getByLabelText(/parar/i)
    expect(stopBtn).toHaveTextContent('■')
    fireEvent.click(stopBtn)
    expect(mockStop).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText(/ouvir resposta/i)).toBeInTheDocument()
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

  it('toca a bolha do paciente com a velocidade selecionada', () => {
    const msgs = [{ role: 'patient' as const, content: 'estou com dor', timestamp: 't' }]
    render(<ConsultationChat consultationId="c-1" initialMessages={msgs} onMessagesUpdate={() => {}} patientGender="M" />)
    // troca a velocidade para 1.5×
    fireEvent.change(screen.getByLabelText(/velocidade/i), { target: { value: '1.5' } })
    fireEvent.click(screen.getByLabelText('ouvir resposta'))
    expect(mockPlay).toHaveBeenCalledWith('estou com dor', 'onyx', 1.5)
  })

  it('velocidade padrão é 1.25×', () => {
    render(<ConsultationChat consultationId="c-1" initialMessages={[]} onMessagesUpdate={() => {}} patientGender="F" />)
    expect((screen.getByLabelText(/velocidade/i) as HTMLSelectElement).value).toBe('1.25')
  })
})
