/** Mapeia o gênero do paciente para uma voz da OpenAI TTS. Default feminino. */
export function voiceForGender(gender: string): string {
  return gender === 'M' ? 'onyx' : 'shimmer'
}
