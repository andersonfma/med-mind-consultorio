/**
 * Limpa o laudo bruto gerado pela IA para exibição/armazenamento:
 * - remove linhas interpretativas (impressão/conclusão/comentário etc.) — o aluno interpreta sozinho
 * - remove formatação markdown (negrito, títulos, tabelas)
 * Idempotente: aplicar sobre texto já limpo não altera o resultado.
 */
export function cleanExamResult(text: string): string {
  const interpretiveStart = /^\s*(impress[ãa]o|conclus[ãa]o|coment[áa]rio|observa[çc][ãa]o|nota|interpreta[çc][ãa]o|considera[çc][õo]es|sugere-se|compat[íi]vel com|achados sugestivos|laudo|resultado do exame)\b/i
  const lines = text.split('\n').filter(line => !interpretiveStart.test(line))
  return lines.join('\n')
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\|/g, ' ')
    .replace(/^[-=]{2,}$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
