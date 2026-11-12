import 'server-only'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { buildDiseaseMapPrompt } from './prompt'
import { parseDiseaseMap, type DiseaseMap } from './schema'

export async function generateDiseaseMap(
  disease: string,
): Promise<DiseaseMap | { outOfScope: true } | null> {
  const completion = await openai.chat.completions.create({
    model: MODELS.generation,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildDiseaseMapPrompt(disease) }],
  }, { timeout: 90_000 })
  const raw = completion.choices[0]?.message?.content
  return raw ? parseDiseaseMap(raw) : null
}
