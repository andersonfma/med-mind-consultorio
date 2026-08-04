import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// MicButton é substituído por um stub que injeta um transcript ao clicar —
// isola a integração do campo (anexar + marcar não salvo) do MediaRecorder real.
vi.mock('./MicButton', () => ({
  MicButton: ({ onTranscript }: { onTranscript: (t: string) => void }) => (
    <button onClick={() => onTranscript('frase ditada')}>mic-stub</button>
  ),
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
