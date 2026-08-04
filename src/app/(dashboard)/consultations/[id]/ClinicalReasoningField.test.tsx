import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// MicButton é substituído por um stub que injeta um transcript ao clicar —
// isola a integração do campo (anexar + marcar não salvo) do MediaRecorder real.
// Também captura o onTranscript mais recente em uma variável de módulo, para
// que os testes de regressão possam invocar uma versão "antiga" (congelada)
// dele, imitando o comportamento do hook real (closure fixado em start()).
let capturedOnTranscript: (t: string) => void = () => {}
vi.mock('./MicButton', () => ({
  MicButton: ({ onTranscript }: { onTranscript: (t: string) => void }) => {
    capturedOnTranscript = onTranscript
    return <button onClick={() => onTranscript('frase ditada')}>mic-stub</button>
  },
}))
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))

import { ClinicalReasoningField } from './ClinicalReasoningField'

describe('ClinicalReasoningField — ditado', () => {
  beforeEach(() => vi.clearAllMocks())

  it('anexa o texto ditado ao valor via onChange', () => {
    const onChange = vi.fn()
    render(<ClinicalReasoningField consultationId="c-1" value="Hipótese A" onChange={onChange} />)
    fireEvent.click(screen.getByText('mic-stub'))
    expect(onChange).toHaveBeenCalledWith('Hipótese A frase ditada')
  })

  it('mantém o caminho só-teclado funcionando', () => {
    const onChange = vi.fn()
    render(<ClinicalReasoningField consultationId="c-1" value="" onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText(/racioc[íi]nio/i), { target: { value: 'digitado' } })
    expect(onChange).toHaveBeenCalledWith('digitado')
  })
})

describe('ClinicalReasoningField — closure congelada do onTranscript (regressão)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('anexa ao texto ATUAL, não ao valor congelado no início da gravação', () => {
    // Simula o hook useVoiceDictation: ele congela o closure onTranscript no
    // início da gravação (recorder.onstop é montado dentro de start()). Este
    // stub captura o onTranscript da PRIMEIRA renderização em uma variável de
    // módulo, imitando esse congelamento, e o teste invoca essa versão antiga
    // DEPOIS que o valor mudou (simulando digitação durante a gravação).
    const onChange = vi.fn()
    const { rerender } = render(
      <ClinicalReasoningField consultationId="c-1" value="A" onChange={onChange} />
    )
    const frozenOnTranscript = capturedOnTranscript

    // Aluno digita durante a gravação: o valor do campo muda.
    rerender(<ClinicalReasoningField consultationId="c-1" value="A B" onChange={onChange} />)

    // A gravação termina e o transcript chega usando o closure congelado.
    act(() => { frozenOnTranscript('ditado') })

    expect(onChange).toHaveBeenCalledWith('A B ditado')
    expect(onChange).not.toHaveBeenCalledWith('A ditado')
  })
})
