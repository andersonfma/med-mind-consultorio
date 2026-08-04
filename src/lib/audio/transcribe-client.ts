/** Envia o áudio para a rota de transcrição e devolve o texto. Lança em falha. */
export async function transcribeBlob(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append('file', blob, 'audio.webm')
  const res = await fetch('/api/transcribe', { method: 'POST', body: form })
  if (!res.ok) throw new Error(`transcription failed: ${res.status}`)
  const data = (await res.json()) as { text?: string }
  return (data.text ?? '').trim()
}

/** Anexa o texto transcrito ao conteúdo atual do campo, separando por um espaço. */
export function appendTranscript(current: string, text: string): string {
  const t = text.trim()
  if (!t) return current
  return current.trim() ? `${current.trim()} ${t}` : t
}
